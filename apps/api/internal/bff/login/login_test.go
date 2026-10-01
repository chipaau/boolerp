package login

import (
	"crypto/rand"
	"crypto/rsa"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/alexedwards/scs/v2/memstore"
	"github.com/go-chi/chi/v5"
	"github.com/go-jose/go-jose/v4"
	"github.com/go-jose/go-jose/v4/jwt"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/boolmv/erp/apps/api/internal/bff/session"
)

// provider is a minimal OpenID Connect provider: discovery, keys, and a token
// endpoint that returns tokens for the next exchange.
type provider struct {
	*httptest.Server
	key     *rsa.PrivateKey
	nonce   string // the nonce the next ID token carries
	refresh string // the refresh token the next exchange returns
}

func newProvider(t *testing.T) *provider {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	require.NoError(t, err)
	p := &provider{key: key, refresh: "refresh-s3cret"}
	mux := http.NewServeMux()
	p.Server = httptest.NewServer(mux)
	t.Cleanup(p.Close)
	mux.HandleFunc("/.well-known/openid-configuration", func(w http.ResponseWriter, _ *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"issuer":                                p.URL,
			"authorization_endpoint":                p.URL + "/oauth2/auth",
			"token_endpoint":                        p.URL + "/oauth2/token",
			"jwks_uri":                              p.URL + "/jwks",
			"id_token_signing_alg_values_supported": []string{"RS256"},
		})
	})
	mux.HandleFunc("/jwks", func(w http.ResponseWriter, _ *http.Request) {
		_ = json.NewEncoder(w).Encode(jose.JSONWebKeySet{Keys: []jose.JSONWebKey{
			{Key: &key.PublicKey, KeyID: "k1", Algorithm: "RS256", Use: "sig"},
		}})
	})
	mux.HandleFunc("/oauth2/token", func(w http.ResponseWriter, r *http.Request) {
		// The client authenticates with its secret, and sends the PKCE verifier.
		id, secret, ok := r.BasicAuth()
		if !ok || id != "erp-app" || secret != "client-s3cret" || r.FormValue("code_verifier") == "" {
			http.Error(w, `{"error":"invalid_client"}`, http.StatusUnauthorized)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"access_token": "access-s3cret", "token_type": "bearer", "expires_in": 600,
			"refresh_token": p.refresh, "id_token": p.idToken(t),
		})
	})
	return p
}

func (p *provider) idToken(t *testing.T) string {
	t.Helper()
	signer, err := jose.NewSigner(jose.SigningKey{Algorithm: jose.RS256, Key: p.key},
		(&jose.SignerOptions{}).WithType("JWT").WithHeader("kid", "k1"))
	require.NoError(t, err)
	now := time.Now()
	raw, err := jwt.Signed(signer).Claims(jwt.Claims{
		Issuer: p.URL, Subject: "account-1", Audience: jwt.Audience{"erp-app"},
		IssuedAt: jwt.NewNumericDate(now), Expiry: jwt.NewNumericDate(now.Add(time.Hour)),
	}).Claims(map[string]any{"nonce": p.nonce, "sid": "hydra-session-1"}).Serialize()
	require.NoError(t, err)
	return raw
}

// app is the login routes behind the session middleware, mounted as the BFF
// mounts them, plus a route that shows the signed-in state.
func app(t *testing.T, p *provider) http.Handler {
	t.Helper()
	sealer, err := session.NewSealer("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f")
	require.NoError(t, err)
	sessions := session.New(nil, sealer, session.Settings{IdleTimeout: time.Hour, Lifetime: 2 * time.Hour}, nil)
	sessions.Store = memstore.New()
	h := New(Settings{Issuer: p.URL, ClientID: "erp-app", ClientSecret: "client-s3cret", Audience: "erp-api"},
		sessions, p.Client(), slog.New(slog.DiscardHandler))
	r := chi.NewRouter()
	r.Route(Prefix, func(r chi.Router) {
		r.Use(sessions.LoadAndSave)
		h.Routes(r)
		r.Get("/whoami", func(w http.ResponseWriter, r *http.Request) {
			in, ok, err := sessions.Current(r.Context())
			require.NoError(t, err)
			if ok {
				_ = json.NewEncoder(w).Encode(in)
			}
		})
	})
	return r
}

// browser keeps cookies between requests to the app.
type browser struct {
	t       *testing.T
	handler http.Handler
	cookies []*http.Cookie
}

func (b *browser) get(target string) *httptest.ResponseRecorder {
	b.t.Helper()
	req := httptest.NewRequest(http.MethodGet, target, nil)
	req.Host = "demo.bool.test"
	for _, c := range b.cookies {
		req.AddCookie(c)
	}
	rec := httptest.NewRecorder()
	b.handler.ServeHTTP(rec, req)
	for _, c := range rec.Result().Cookies() {
		b.cookies = []*http.Cookie{c} // one session cookie
	}
	return rec
}

func (b *browser) whoami() (session.SignedIn, bool) {
	b.t.Helper()
	body := b.get("/auth/whoami").Body.String()
	if body == "" {
		return session.SignedIn{}, false
	}
	var in session.SignedIn
	require.NoError(b.t, json.Unmarshal([]byte(body), &in))
	return in, true
}

// startLogin follows /auth/login and returns the authorization request's query.
func startLogin(t *testing.T, b *browser, returnTo string) url.Values {
	t.Helper()
	rec := b.get("/auth/login?return_to=" + url.QueryEscape(returnTo))
	require.Equal(t, http.StatusFound, rec.Code, rec.Body.String())
	u, err := url.Parse(rec.Header().Get("Location"))
	require.NoError(t, err)
	return u.Query()
}

func TestLoginRedirectsWithPKCENonceAndAudience(t *testing.T) {
	p := newProvider(t)
	q := startLogin(t, &browser{t: t, handler: app(t, p)}, "/settings")

	assert.Equal(t, "erp-app", q.Get("client_id"))
	assert.Equal(t, "code", q.Get("response_type"))
	assert.Equal(t, "openid offline_access", q.Get("scope"))
	assert.Equal(t, "erp-api", q.Get("audience"), "so the API accepts the access token")
	// The callback is on the domain the browser is on; plain HTTP here.
	assert.Equal(t, "http://demo.bool.test/auth/callback", q.Get("redirect_uri"))
	assert.Equal(t, "S256", q.Get("code_challenge_method"))
	assert.NotEmpty(t, q.Get("code_challenge"))
	assert.Len(t, q.Get("state"), 43, "32 random bytes, base64url")
	assert.Len(t, q.Get("nonce"), 43)
}

func TestCallbackSignsInWithANewSessionToken(t *testing.T) {
	p := newProvider(t)
	b := &browser{t: t, handler: app(t, p)}
	q := startLogin(t, b, "/settings")
	before := b.cookies[0].Value
	p.nonce = q.Get("nonce")

	rec := b.get("/auth/callback?code=c1&state=" + q.Get("state"))

	require.Equal(t, http.StatusFound, rec.Code, rec.Body.String())
	assert.Equal(t, "/settings", rec.Header().Get("Location"))
	assert.NotEqual(t, before, b.cookies[0].Value, "a new token at login (no session fixation)")
	assert.NotContains(t, rec.Body.String()+rec.Header().Get("Location"), "s3cret", "no token reaches the browser")

	in, ok := b.whoami()
	require.True(t, ok)
	assert.Equal(t, "account-1", in.Account)
	assert.Equal(t, "hydra-session-1", in.HydraSession)
	assert.Equal(t, "access-s3cret", in.Tokens.Access)
	assert.Equal(t, "refresh-s3cret", in.Tokens.Refresh)
	assert.NotEmpty(t, in.Tokens.IDToken)
	assert.WithinDuration(t, time.Now().Add(10*time.Minute), in.Tokens.Expiry, time.Minute)
}

func TestCallbackRefusesAWrongState(t *testing.T) {
	p := newProvider(t)
	b := &browser{t: t, handler: app(t, p)}
	q := startLogin(t, b, "/")
	p.nonce = q.Get("nonce")

	rec := b.get("/auth/callback?code=c1&state=forged")

	assert.Equal(t, http.StatusBadRequest, rec.Code)
	_, ok := b.whoami()
	assert.False(t, ok, "not signed in")
	// The state is single-use: the real one no longer works either.
	assert.Equal(t, http.StatusBadRequest, b.get("/auth/callback?code=c1&state="+q.Get("state")).Code)
}

func TestCallbackRefusesAWrongNonce(t *testing.T) {
	p := newProvider(t)
	b := &browser{t: t, handler: app(t, p)}
	q := startLogin(t, b, "/")
	p.nonce = "replayed-nonce"

	assert.Equal(t, http.StatusBadRequest, b.get("/auth/callback?code=c1&state="+q.Get("state")).Code)
	_, ok := b.whoami()
	assert.False(t, ok, "not signed in")
}

func TestCallbackNeedsARefreshToken(t *testing.T) {
	p := newProvider(t)
	p.refresh = ""
	b := &browser{t: t, handler: app(t, p)}
	q := startLogin(t, b, "/")
	p.nonce = q.Get("nonce")

	assert.Equal(t, http.StatusBadGateway, b.get("/auth/callback?code=c1&state="+q.Get("state")).Code)
	_, ok := b.whoami()
	assert.False(t, ok, "not signed in")
}

func TestCallbackReportsARefusedLogin(t *testing.T) {
	p := newProvider(t)
	b := &browser{t: t, handler: app(t, p)}
	q := startLogin(t, b, "/")

	rec := b.get("/auth/callback?error=access_denied&error_description=nope&state=" + q.Get("state"))

	assert.Equal(t, http.StatusForbidden, rec.Code)
	assert.NotContains(t, rec.Body.String(), "nope", "the provider's description is not echoed")
}

func TestReturnToStaysOnThisSite(t *testing.T) {
	for in, want := range map[string]string{
		"/settings?tab=1":     "/settings?tab=1",
		"":                    "/",
		"https://evil.test/":  "/",
		"//evil.test/":        "/",
		"/\\evil.test":        "/",
		"settings":            "/",
		"/ok\r\nSet-Cookie:x": "/",
	} {
		assert.Equal(t, want, safeReturnTo(in), "return_to %q", in)
	}
}

func TestLoginUnavailableWhileTheProviderIsDown(t *testing.T) {
	p := newProvider(t)
	p.Close()
	rec := (&browser{t: t, handler: app(t, p)}).get("/auth/login")
	assert.Equal(t, http.StatusServiceUnavailable, rec.Code)
	assert.True(t, strings.HasPrefix(rec.Header().Get("Content-Type"), "application/problem+json"))
}
