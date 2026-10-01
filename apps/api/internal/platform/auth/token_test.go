package auth

import (
	"crypto/rand"
	"crypto/rsa"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-jose/go-jose/v4"
	"github.com/go-jose/go-jose/v4/jwt"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// issuer publishes a signing key at /.well-known/jwks.json, as Hydra does.
type issuer struct {
	*httptest.Server
	key *rsa.PrivateKey
}

func newIssuer(t *testing.T) *issuer {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	require.NoError(t, err)
	iss := &issuer{key: key}
	iss.Server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/.well-known/jwks.json" {
			http.NotFound(w, r)
			return
		}
		_ = json.NewEncoder(w).Encode(jose.JSONWebKeySet{Keys: []jose.JSONWebKey{
			{Key: &key.PublicKey, KeyID: "k1", Algorithm: "RS256", Use: "sig"},
		}})
	}))
	t.Cleanup(iss.Close)
	return iss
}

// url is the issuer as Hydra writes it, with a trailing slash.
func (iss *issuer) url() string { return iss.URL + "/" }

type claims struct {
	issuer   string
	audience []string
	expires  time.Time
	clientID string
	key      *rsa.PrivateKey // signs the token; another key forges it
}

func (iss *issuer) valid() claims {
	return claims{issuer: iss.url(), audience: []string{"erp-api"}, expires: time.Now().Add(10 * time.Minute), clientID: "bff-app", key: iss.key}
}

func sign(t *testing.T, c claims) string {
	t.Helper()
	signer, err := jose.NewSigner(jose.SigningKey{Algorithm: jose.RS256, Key: c.key},
		(&jose.SignerOptions{}).WithType("JWT").WithHeader("kid", "k1"))
	require.NoError(t, err)
	private := map[string]any{"scp": []string{"openid"}}
	if c.clientID != "" {
		private["client_id"] = c.clientID
	}
	raw, err := jwt.Signed(signer).Claims(jwt.Claims{
		Issuer: c.issuer, Subject: "account-1", Audience: c.audience,
		IssuedAt: jwt.NewNumericDate(c.expires.Add(-10 * time.Minute)), Expiry: jwt.NewNumericDate(c.expires),
	}).Claims(private).Serialize()
	require.NoError(t, err)
	return raw
}

// call sends a request with the Authorization header through the middleware to
// a handler that echoes the verified token.
func call(t *testing.T, iss *issuer, authorization string) *httptest.ResponseRecorder {
	t.Helper()
	m := New(t.Context(), Settings{Issuer: iss.url(), Audience: "erp-api"}, iss.Client())
	handler := m.Authenticate(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token, ok := FromContext(r.Context())
		require.True(t, ok)
		_, _ = io.WriteString(w, token.Subject+" via "+token.ClientID)
	}))
	req := httptest.NewRequest(http.MethodGet, "/api/me", nil)
	if authorization != "" {
		req.Header.Set("Authorization", authorization)
	}
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	return rec
}

func TestValidTokenPasses(t *testing.T) {
	iss := newIssuer(t)
	rec := call(t, iss, "Bearer "+sign(t, iss.valid()))
	assert.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.Equal(t, "account-1 via bff-app", rec.Body.String())
}

func TestSchemeIsCaseInsensitive(t *testing.T) {
	iss := newIssuer(t)
	assert.Equal(t, http.StatusOK, call(t, iss, "bearer "+sign(t, iss.valid())).Code)
}

func TestMissingTokenAsksForOne(t *testing.T) {
	iss := newIssuer(t)
	for _, header := range []string{"", "Basic dXNlcjpwYXNz", "Bearer ", "Bearer"} {
		rec := call(t, iss, header)
		assert.Equal(t, http.StatusUnauthorized, rec.Code, "header %q", header)
		assert.Equal(t, "Bearer", rec.Header().Get("WWW-Authenticate"), "header %q", header)
		assert.Contains(t, rec.Header().Get("Content-Type"), "application/problem+json")
	}
}

func TestInvalidTokensAreRefused(t *testing.T) {
	iss := newIssuer(t)
	forger, err := rsa.GenerateKey(rand.Reader, 2048)
	require.NoError(t, err)
	cases := map[string]func(c *claims){
		"expired beyond the allowance": func(c *claims) { c.expires = time.Now().Add(-ClockSkew - 5*time.Second) },
		"wrong issuer":                 func(c *claims) { c.issuer = "http://elsewhere.test/" },
		"wrong audience":               func(c *claims) { c.audience = []string{"another-api"} },
		"forged signature":             func(c *claims) { c.key = forger },
		"ID token (no client_id)":      func(c *claims) { c.clientID = "" },
	}
	for name, change := range cases {
		t.Run(name, func(t *testing.T) {
			c := iss.valid()
			change(&c)
			token := sign(t, c)
			rec := call(t, iss, "Bearer "+token)
			assert.Equal(t, http.StatusUnauthorized, rec.Code)
			assert.Equal(t, `Bearer error="invalid_token"`, rec.Header().Get("WWW-Authenticate"))
			assert.NotContains(t, rec.Body.String(), token, "the token is not echoed")
		})
	}
	t.Run("not a JWT", func(t *testing.T) {
		assert.Equal(t, http.StatusUnauthorized, call(t, iss, "Bearer s3cret-garbage").Code)
	})
}

func TestRecentlyExpiredTokenIsWithinTheAllowance(t *testing.T) {
	iss := newIssuer(t)
	c := iss.valid()
	c.expires = time.Now().Add(-ClockSkew / 2) // a slow clock on the API's side
	assert.Equal(t, http.StatusOK, call(t, iss, "Bearer "+sign(t, c)).Code)
}

func TestRoutesProtectMe(t *testing.T) {
	iss := newIssuer(t)
	m := New(t.Context(), Settings{Issuer: iss.url(), Audience: "erp-api"}, iss.Client())
	r := chi.NewRouter()
	r.Route("/api/auth", m.Routes) // as bootstrap mounts it

	req := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	assert.Equal(t, http.StatusUnauthorized, rec.Code, "the module applies authentication itself")

	req.Header.Set("Authorization", "Bearer "+sign(t, iss.valid()))
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	assert.Equal(t, http.StatusOK, rec.Code)
	assert.JSONEq(t, `{"subject":"account-1","clientId":"bff-app"}`, rec.Body.String())
}
