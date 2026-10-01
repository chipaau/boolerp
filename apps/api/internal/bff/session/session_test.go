package session

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/alexedwards/scs/v2/memstore"
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

func newSessions(t *testing.T, key string, secure bool) *Sessions {
	t.Helper()
	s := New(nil, sealer(t, key), Settings{IdleTimeout: 30 * time.Minute, Lifetime: 12 * time.Hour, CookieSecure: secure}, nil)
	s.Store = memstore.New()
	return s
}

func TestSignInAndCurrent(t *testing.T) {
	s := newSessions(t, keyA, true)
	want := SignedIn{Account: "account-1", HydraSession: "sid-1", Tokens: Tokens{
		Access: "access-s3cret", Refresh: "refresh-s3cret", IDToken: "id-s3cret",
		Expiry: time.Date(2026, 10, 1, 12, 0, 0, 0, time.UTC),
	}}
	cookies := inSession(t, s, nil, func(ctx context.Context) { require.NoError(t, s.SignIn(ctx, want)) })

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
		assert.Equal(t, want, got)
		raw, _ := s.Get(ctx, keyTokens).([]byte)
		assert.False(t, bytes.Contains(raw, []byte("s3cret")), "tokens are stored sealed")
	})
}

func TestPlainHTTPUsesThePlainCookieName(t *testing.T) {
	s := newSessions(t, keyA, false)
	cookies := inSession(t, s, nil, func(ctx context.Context) {
		require.NoError(t, s.SignIn(ctx, SignedIn{Account: "account-1"}))
	})
	require.Len(t, cookies, 1)
	assert.Equal(t, "session", cookies[0].Name)
	assert.False(t, cookies[0].Secure)
}

func TestAReplacedKeySignsOut(t *testing.T) {
	store := memstore.New()
	old := newSessions(t, keyA, true)
	old.Store = store
	cookies := inSession(t, old, nil, func(ctx context.Context) {
		require.NoError(t, old.SignIn(ctx, SignedIn{Account: "account-1", Tokens: Tokens{Refresh: "r"}}))
	})

	replaced := newSessions(t, keyB, true)
	replaced.Store = store
	inSession(t, replaced, cookies, func(ctx context.Context) {
		_, ok, err := replaced.Current(ctx)
		require.NoError(t, err)
		assert.False(t, ok, "signed out, so the browser signs in again")
		assert.Empty(t, replaced.GetString(ctx, keyAccount), "the session is destroyed")
	})
}

func TestNotSignedIn(t *testing.T) {
	s := newSessions(t, keyA, true)
	inSession(t, s, nil, func(ctx context.Context) {
		_, ok, err := s.Current(ctx)
		require.NoError(t, err)
		assert.False(t, ok)
	})
}
