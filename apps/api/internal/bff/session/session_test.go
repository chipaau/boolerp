package session

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	goredis "github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const (
	keyA = "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"
	keyB = "1f1e1d1c1b1a191817161514131211100f0e0d0c0b0a09080706050403020100"
)

func sealer(t *testing.T, key string) *Sealer {
	t.Helper()
	s, err := NewSealer(key)
	require.NoError(t, err)
	return s
}

func TestSealOpens(t *testing.T) {
	s := sealer(t, keyA)
	sealed := s.Seal([]byte("refresh-s3cret"), "account-1")
	assert.False(t, bytes.Contains(sealed, []byte("refresh-s3cret")), "sealed values are not plaintext")
	got, err := s.Open(sealed, "account-1")
	require.NoError(t, err)
	assert.Equal(t, "refresh-s3cret", string(got))
	assert.NotEqual(t, sealed, s.Seal([]byte("refresh-s3cret"), "account-1"), "a fresh nonce each time")
}

func TestSealedValuesDoNotOpenElsewhere(t *testing.T) {
	sealed := sealer(t, keyA).Seal([]byte("refresh-s3cret"), "account-1")
	tampered := bytes.Clone(sealed)
	tampered[len(tampered)-1] ^= 1

	for name, open := range map[string]func() ([]byte, error){
		"another session": func() ([]byte, error) { return sealer(t, keyA).Open(sealed, "account-2") },
		"another key":     func() ([]byte, error) { return sealer(t, keyB).Open(sealed, "account-1") },
		"altered":         func() ([]byte, error) { return sealer(t, keyA).Open(tampered, "account-1") },
		"truncated":       func() ([]byte, error) { return sealer(t, keyA).Open(sealed[:5], "account-1") },
	} {
		_, err := open()
		assert.ErrorIs(t, err, ErrUnreadable, name)
	}
}

func TestNewSealerRefusesBadKeys(t *testing.T) {
	for _, key := range []string{"", "abcd", strings.Repeat("z", 64), keyA + "00"} {
		_, err := NewSealer(key)
		assert.Error(t, err, "key %q", key)
	}
}

// inSession runs fn inside a request carrying the given cookies, through the
// session middleware, and returns the cookies the response sets.
func inSession(t *testing.T, s *Sessions, cookies []*http.Cookie, fn func(ctx context.Context)) []*http.Cookie {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	for _, c := range cookies {
		req.AddCookie(c)
	}
	rec := httptest.NewRecorder()
	s.LoadAndSave(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) { fn(r.Context()) })).ServeHTTP(rec, req)
	resp := rec.Result()
	defer resp.Body.Close()
	return resp.Cookies()
}

// redisFor returns a client for an in-memory Redis (miniredis) and the server.
func redisFor(t *testing.T) (*goredis.Client, *miniredis.Miniredis) {
	t.Helper()
	mr := miniredis.RunT(t)
	client := goredis.NewClient(&goredis.Options{Addr: mr.Addr()})
	t.Cleanup(func() { _ = client.Close() })
	return client, mr
}

func newSessions(t *testing.T, client *goredis.Client, key string, secure bool) *Sessions {
	t.Helper()
	return New(client, sealer(t, key), Settings{
		KeyPrefix: "bff:test:", IdleTimeout: 30 * time.Minute, Lifetime: 12 * time.Hour, CookieSecure: secure,
	}, nil)
}

var signedIn = SignedIn{Account: "account-1", HydraSession: "sid-1", Tokens: Tokens{
	Access: "access-s3cret", Refresh: "refresh-s3cret", IDToken: "id-s3cret",
	Expiry: time.Date(2026, 10, 1, 12, 0, 0, 0, time.UTC),
}}

func TestSignInAndCurrent(t *testing.T) {
	client, mr := redisFor(t)
	s := newSessions(t, client, keyA, true)
	cookies := inSession(t, s, nil, func(ctx context.Context) { require.NoError(t, s.SignIn(ctx, signedIn)) })

	require.Len(t, cookies, 1)
	c := cookies[0]
	assert.Equal(t, "__Host-session", c.Name)
	assert.True(t, c.HttpOnly)
	assert.True(t, c.Secure)
	assert.Equal(t, http.SameSiteLaxMode, c.SameSite)
	assert.Equal(t, "/", c.Path)
	assert.Empty(t, c.Domain, "host-only")
	assert.True(t, c.Expires.IsZero(), "a browser-session cookie")

	inSession(t, s, cookies, func(ctx context.Context) {
		got, ok, err := s.Current(ctx)
		require.NoError(t, err)
		require.True(t, ok)
		assert.NotEmpty(t, got.TokensID)
		got.TokensID = ""
		assert.Equal(t, signedIn, got)
	})

	// The session, its tokens, and its Hydra login's list; none holds a readable token.
	keys := mr.Keys()
	require.Len(t, keys, 3)
	for _, k := range keys {
		assert.True(t, strings.HasPrefix(k, "bff:test:session:") || strings.HasPrefix(k, "bff:test:tokens:") ||
			k == "bff:test:hydra-session:sid-1", k)
		v, _ := mr.Get(k)
		assert.NotContains(t, v, "s3cret", k)
		assert.LessOrEqual(t, mr.TTL(k), 12*time.Hour, k)
	}
}

func TestAStaleSessionSaveKeepsRefreshedTokens(t *testing.T) {
	client, _ := redisFor(t)
	s := newSessions(t, client, keyA, true)
	cookies := inSession(t, s, nil, func(ctx context.Context) { require.NoError(t, s.SignIn(ctx, signedIn)) })

	// Request B loads the session; request A refreshes and saves new tokens;
	// then B ends, and scs saves B's copy of the session (C98).
	inSession(t, s, cookies, func(ctxB context.Context) {
		inSession(t, s, cookies, func(ctxA context.Context) {
			in, ok, err := s.Current(ctxA)
			require.NoError(t, err)
			require.True(t, ok)
			in.Tokens.Refresh = "refresh-2"
			require.NoError(t, s.SaveTokens(ctxA, in))
		})
	})

	inSession(t, s, cookies, func(ctx context.Context) {
		got, ok, err := s.Current(ctx)
		require.NoError(t, err)
		require.True(t, ok)
		assert.Equal(t, "refresh-2", got.Tokens.Refresh, "the refreshed tokens survive")
	})
}

func TestPlainHTTPUsesThePlainCookieName(t *testing.T) {
	client, _ := redisFor(t)
	s := newSessions(t, client, keyA, false)
	cookies := inSession(t, s, nil, func(ctx context.Context) { require.NoError(t, s.SignIn(ctx, signedIn)) })
	require.Len(t, cookies, 1)
	assert.Equal(t, "session", cookies[0].Name)
	assert.False(t, cookies[0].Secure)
}

func TestAReplacedKeySignsOut(t *testing.T) {
	client, mr := redisFor(t)
	old := newSessions(t, client, keyA, true)
	cookies := inSession(t, old, nil, func(ctx context.Context) { require.NoError(t, old.SignIn(ctx, signedIn)) })

	replaced := newSessions(t, client, keyB, true)
	inSession(t, replaced, cookies, func(ctx context.Context) {
		_, ok, err := replaced.Current(ctx)
		require.NoError(t, err)
		assert.False(t, ok, "signed out, so the browser signs in again")
	})
	assert.Empty(t, mr.Keys(), "the session and its tokens are deleted")
}

func TestMissingTokensSignOut(t *testing.T) {
	client, mr := redisFor(t)
	s := newSessions(t, client, keyA, true)
	cookies := inSession(t, s, nil, func(ctx context.Context) { require.NoError(t, s.SignIn(ctx, signedIn)) })
	for _, k := range mr.Keys() {
		if strings.HasPrefix(k, "bff:test:tokens:") {
			mr.Del(k)
		}
	}
	inSession(t, s, cookies, func(ctx context.Context) {
		_, ok, err := s.Current(ctx)
		require.NoError(t, err)
		assert.False(t, ok)
	})
}

func TestUnavailableRedisIsAnError(t *testing.T) {
	client, mr := redisFor(t)
	s := newSessions(t, client, keyA, true)
	cookies := inSession(t, s, nil, func(ctx context.Context) { require.NoError(t, s.SignIn(ctx, signedIn)) })
	// The session loads, then Redis fails before the tokens are read.
	inSession(t, s, cookies, func(ctx context.Context) {
		mr.SetError("LOADING")
		_, _, err := s.Current(ctx)
		assert.Error(t, err)
		mr.SetError("")
	})
}

func TestNotSignedIn(t *testing.T) {
	client, _ := redisFor(t)
	s := newSessions(t, client, keyA, true)
	inSession(t, s, nil, func(ctx context.Context) {
		_, ok, err := s.Current(ctx)
		require.NoError(t, err)
		assert.False(t, ok)
	})
}

func TestEndingAHydraSessionSignsOutItsSessions(t *testing.T) {
	client, _ := redisFor(t)
	s := newSessions(t, client, keyA, true)
	app := inSession(t, s, nil, func(ctx context.Context) { require.NoError(t, s.SignIn(ctx, signedIn)) })
	tab := inSession(t, s, nil, func(ctx context.Context) { require.NoError(t, s.SignIn(ctx, signedIn)) })
	other := signedIn
	other.HydraSession = "sid-2"
	elsewhere := inSession(t, s, nil, func(ctx context.Context) { require.NoError(t, s.SignIn(ctx, other)) })

	require.NoError(t, s.EndHydraSession(t.Context(), "sid-1"))

	for name, cookies := range map[string][]*http.Cookie{"app": app, "second tab": tab} {
		inSession(t, s, cookies, func(ctx context.Context) {
			_, ok, err := s.Current(ctx)
			require.NoError(t, err)
			assert.False(t, ok, "%s: signed out", name)
		})
	}
	inSession(t, s, elsewhere, func(ctx context.Context) {
		_, ok, err := s.Current(ctx)
		require.NoError(t, err)
		assert.True(t, ok, "another login stays signed in")
	})
	assert.NoError(t, s.EndHydraSession(t.Context(), "unknown"), "an unknown login is nothing to do")
}

func TestSignOutLeavesNothingBehind(t *testing.T) {
	client, mr := redisFor(t)
	s := newSessions(t, client, keyA, true)
	cookies := inSession(t, s, nil, func(ctx context.Context) { require.NoError(t, s.SignIn(ctx, signedIn)) })
	inSession(t, s, cookies, func(ctx context.Context) { require.NoError(t, s.SignOut(ctx)) })
	assert.Empty(t, mr.Keys())
}
