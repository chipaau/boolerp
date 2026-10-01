package proxy

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	goredis "github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/boolmv/erp/apps/api/internal/bff/session"
)

var errRefused = errors.New("refused")

// seen is what the stand-in API received.
type seen struct {
	Path, Host, Authorization, Cookie, ForwardedFor, Origin string
}

// fixture is a BFF with the proxy at /api/*, a sign-in route, and a stand-in API.
type fixture struct {
	t        *testing.T
	handler  http.Handler
	cookies  []*http.Cookie
	refresh  func(ctx context.Context, old session.Tokens) (session.Tokens, error)
	refreshN atomic.Int32
	now      time.Time
}

func newFixture(t *testing.T) *fixture {
	t.Helper()
	f := &fixture{t: t, now: time.Now()}
	api := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Set-Cookie", "api=1")
		_ = json.NewEncoder(w).Encode(seen{
			Path: r.URL.Path, Host: r.Host, Authorization: r.Header.Get("Authorization"),
			Cookie: r.Header.Get("Cookie"), ForwardedFor: r.Header.Get("X-Forwarded-For"), Origin: r.Header.Get("Origin"),
		})
	}))
	t.Cleanup(api.Close)
	target, err := url.Parse(api.URL)
	require.NoError(t, err)

	client := goredis.NewClient(&goredis.Options{Addr: miniredis.RunT(t).Addr()})
	t.Cleanup(func() { _ = client.Close() })
	sealer, err := session.NewSealer("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f")
	require.NoError(t, err)
	sessions := session.New(client, sealer, session.Settings{KeyPrefix: "bff:test:", IdleTimeout: time.Hour, Lifetime: 2 * time.Hour}, nil)

	refresh := func(ctx context.Context, old session.Tokens) (session.Tokens, error) {
		f.refreshN.Add(1)
		return f.refresh(ctx, old)
	}
	p := New(target, http.DefaultTransport, sessions, refresh, errRefused, slog.New(slog.DiscardHandler))
	p.now = func() time.Time { return f.now }

	r := chi.NewRouter()
	r.Use(middleware.ClientIPFromXFFTrustedProxies(1))
	r.Use(sessions.LoadAndSave)
	r.Get("/signin", func(_ http.ResponseWriter, r *http.Request) {
		require.NoError(t, sessions.SignIn(r.Context(), session.SignedIn{Account: "account-1", Tokens: session.Tokens{
			Access: "access-1", Refresh: "refresh-1", Expiry: f.now.Add(10 * time.Minute),
		}}))
	})
	r.Handle("/api/*", p)
	f.handler = r
	f.refresh = func(context.Context, session.Tokens) (session.Tokens, error) {
		return session.Tokens{Access: "access-2", Refresh: "refresh-2", Expiry: f.now.Add(10 * time.Minute)}, nil
	}
	return f
}

func (f *fixture) do(method, target string, header http.Header) *httptest.ResponseRecorder {
	f.t.Helper()
	req := httptest.NewRequest(method, target, nil)
	req.Host = "demo.bool.test"
	req.RemoteAddr = "10.0.0.2:5000" // the proxy in front
	for k, v := range header {
		req.Header[k] = v
	}
	for _, c := range f.cookies {
		req.AddCookie(c)
	}
	rec := httptest.NewRecorder()
	f.handler.ServeHTTP(rec, req)
	resp := rec.Result()
	defer resp.Body.Close()
	for _, c := range resp.Cookies() {
		if c.Name == session.CookieNameNoHTTPS {
			f.cookies = []*http.Cookie{c}
		}
	}
	return rec
}

func (f *fixture) signIn() {
	f.t.Helper()
	f.do(http.MethodGet, "/signin", nil)
	require.Len(f.t, f.cookies, 1)
}

func (f *fixture) api(target string) (seen, *httptest.ResponseRecorder) {
	f.t.Helper()
	rec := f.do(http.MethodGet, target, http.Header{
		"Authorization":   {"Bearer browser-supplied"},
		"X-Forwarded-For": {"198.51.100.7"},
		"Origin":          {"http://demo.bool.test"},
	})
	var s seen
	if rec.Code == http.StatusOK {
		require.NoError(f.t, json.Unmarshal(rec.Body.Bytes(), &s))
	}
	return s, rec
}

func TestForwardsWithTheSessionToken(t *testing.T) {
	f := newFixture(t)
	f.signIn()

	got, rec := f.api("/api/auth/me?x=1")

	require.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, "/api/auth/me", got.Path)
	assert.Equal(t, "Bearer access-1", got.Authorization, "the session's token, not the browser's")
	assert.Empty(t, got.Cookie, "the browser's cookie never reaches the API")
	assert.Equal(t, "demo.bool.test", got.Host, "the API sees the browser's host")
	assert.Equal(t, "198.51.100.7", got.ForwardedFor, "the client, as the BFF determined it")
	assert.Equal(t, "http://demo.bool.test", got.Origin)
	for _, c := range rec.Header().Values("Set-Cookie") {
		assert.False(t, strings.HasPrefix(c, "api="), "the API's cookies are dropped")
	}
	assert.Zero(t, f.refreshN.Load())
}

func TestNotSignedInIs401WithoutCallingTheAPI(t *testing.T) {
	f := newFixture(t)
	_, rec := f.api("/api/auth/me")
	assert.Equal(t, http.StatusUnauthorized, rec.Code)
	assert.True(t, strings.HasPrefix(rec.Header().Get("Content-Type"), "application/problem+json"))
}

func TestRefreshesShortlyBeforeExpiry(t *testing.T) {
	f := newFixture(t)
	f.signIn()
	f.now = f.now.Add(9*time.Minute + 30*time.Second) // 30s left, within RefreshBefore

	got, rec := f.api("/api/auth/me")
	require.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, "Bearer access-2", got.Authorization)

	got, _ = f.api("/api/auth/me")
	assert.Equal(t, "Bearer access-2", got.Authorization, "the refreshed tokens were saved")
	assert.EqualValues(t, 1, f.refreshN.Load())
}

func TestConcurrentRequestsShareOneRefresh(t *testing.T) {
	f := newFixture(t)
	f.signIn()
	f.now = f.now.Add(10 * time.Minute) // expired
	release := make(chan struct{})
	f.refresh = func(context.Context, session.Tokens) (session.Tokens, error) {
		<-release // hold the first refresh until every request is waiting
		return session.Tokens{Access: "access-2", Refresh: "refresh-2", Expiry: f.now.Add(10 * time.Minute)}, nil
	}

	var wg sync.WaitGroup
	results := make([]string, 8)
	for i := range results {
		wg.Go(func() {
			req := httptest.NewRequest(http.MethodGet, "/api/x", nil)
			req.Host = "demo.bool.test"
			req.AddCookie(f.cookies[0])
			rec := httptest.NewRecorder()
			f.handler.ServeHTTP(rec, req)
			var s seen
			_ = json.Unmarshal(rec.Body.Bytes(), &s)
			results[i] = s.Authorization
		})
	}
	time.Sleep(100 * time.Millisecond)
	close(release)
	wg.Wait()

	assert.EqualValues(t, 1, f.refreshN.Load(), "one refresh for all of them")
	for _, a := range results {
		assert.Equal(t, "Bearer access-2", a)
	}
}

func TestARefusedRefreshSignsOut(t *testing.T) {
	f := newFixture(t)
	f.signIn()
	f.now = f.now.Add(10 * time.Minute)
	f.refresh = func(context.Context, session.Tokens) (session.Tokens, error) { return session.Tokens{}, errRefused }

	_, rec := f.api("/api/auth/me")
	assert.Equal(t, http.StatusUnauthorized, rec.Code)

	f.refresh = func(context.Context, session.Tokens) (session.Tokens, error) {
		return session.Tokens{Access: "access-2", Expiry: f.now.Add(time.Hour)}, nil
	}
	_, rec = f.api("/api/auth/me")
	assert.Equal(t, http.StatusUnauthorized, rec.Code, "the session is gone")
	assert.EqualValues(t, 1, f.refreshN.Load())
}

func TestAnUnavailableProviderKeepsTheSession(t *testing.T) {
	f := newFixture(t)
	f.signIn()
	f.now = f.now.Add(10 * time.Minute)
	f.refresh = func(context.Context, session.Tokens) (session.Tokens, error) {
		return session.Tokens{}, errors.New("connection refused")
	}

	_, rec := f.api("/api/auth/me")
	assert.Equal(t, http.StatusServiceUnavailable, rec.Code)

	f.refresh = func(context.Context, session.Tokens) (session.Tokens, error) {
		return session.Tokens{Access: "access-2", Refresh: "refresh-2", Expiry: f.now.Add(10 * time.Minute)}, nil
	}
	got, rec := f.api("/api/auth/me")
	require.Equal(t, http.StatusOK, rec.Code, "still signed in")
	assert.Equal(t, "Bearer access-2", got.Authorization)
}

func TestAnUnavailableAPIIs502(t *testing.T) {
	f := newFixture(t)
	f.signIn()
	dead := httptest.NewServer(http.NotFoundHandler())
	target, _ := url.Parse(dead.URL)
	dead.Close()
	// The forwarding itself, pointed at a closed port.
	reverse := New(target, http.DefaultTransport, nil, nil, errRefused, slog.New(slog.DiscardHandler)).reverse
	rec := httptest.NewRecorder()
	reverse.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/x", nil))
	assert.Equal(t, http.StatusBadGateway, rec.Code)
	assert.NotContains(t, rec.Body.String(), "127.0.0.1", "no internal address in the answer")
}
