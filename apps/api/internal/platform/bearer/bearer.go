// Package bearer accepts API callers by Hydra access token (C88, C91): a JWT sent
// as Authorization: Bearer, verified locally against the issuer's published keys
// (no call to Hydra per request). github.com/coreos/go-oidc caches the keys and
// fetches them again when Hydra rotates them; it checks the signature, issuer,
// audience, and expiry. This package adds what go-oidc does not: reading the
// header, refusing ID tokens, and answering RFC 6750 errors as problem details.
package bearer

import (
	"context"
	"net/http"
	"strings"
	"time"

	"github.com/coreos/go-oidc/v3/oidc"

	"github.com/boolmv/erp/apps/api/internal/platform/problem"
)

// ClockSkew is how far a server's clock may lag Hydra's before a fresh token
// counts as expired (C91).
const ClockSkew = 30 * time.Second

// Token is what a verified access token says about the caller.
type Token struct {
	Subject  string   // the account ID (sub); empty for a client acting for itself
	ClientID string   // the OAuth2 client the token was issued to (such as bff-app)
	Scopes   []string // granted scopes (scp)
}

// Verifier checks access tokens.
type Verifier struct {
	verifier *oidc.IDTokenVerifier
}

// New returns a verifier for tokens from issuer meant for audience. Keys are
// fetched from <issuer>.well-known/jwks.json on first use, with client, and
// cached; ctx bounds those fetches, so pass the application's lifetime context.
func New(ctx context.Context, issuer, audience string, client *http.Client) *Verifier {
	jwks := strings.TrimSuffix(issuer, "/") + "/.well-known/jwks.json"
	keys := oidc.NewRemoteKeySet(oidc.ClientContext(ctx, client), jwks)
	return &Verifier{verifier: oidc.NewVerifier(issuer, keys, &oidc.Config{
		// Despite the name, ClientID is the audience the token must include.
		ClientID: audience,
		// go-oidc checks expiry without any allowance; checking against a clock
		// set ClockSkew earlier accepts tokens that expired within ClockSkew.
		Now: func() time.Time { return time.Now().Add(-ClockSkew) },
	})}
}

// Verify checks a raw access token.
func (v *Verifier) Verify(ctx context.Context, raw string) (Token, error) {
	t, err := v.verifier.Verify(ctx, raw)
	if err != nil {
		return Token{}, err
	}
	var claims struct {
		ClientID string   `json:"client_id"`
		Scopes   []string `json:"scp"`
	}
	if err := t.Claims(&claims); err != nil {
		return Token{}, err
	}
	// Hydra's access tokens name the client they were issued to; its ID tokens do
	// not. Without this, an ID token for a client whose ID equals the audience
	// would pass as an access token.
	if claims.ClientID == "" {
		return Token{}, errNotAccessToken
	}
	return Token{Subject: t.Subject, ClientID: claims.ClientID, Scopes: claims.Scopes}, nil
}

type tokenError string

func (e tokenError) Error() string { return string(e) }

const errNotAccessToken = tokenError("bearer: not an access token (no client_id)")

type contextKey struct{}

// FromContext returns the verified token of the request, if any.
func FromContext(ctx context.Context) (Token, bool) {
	t, ok := ctx.Value(contextKey{}).(Token)
	return t, ok
}

// Middleware lets a request through only with a valid access token, which it
// puts in the request context. Otherwise it answers 401 with
// WWW-Authenticate: Bearer (RFC 6750) and problem details; the token and the
// reason it failed are not echoed.
func (v *Verifier) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		raw, ok := fromHeader(r.Header.Get("Authorization"))
		if !ok {
			w.Header().Set("WWW-Authenticate", `Bearer`)
			problem.Error(w, r, http.StatusUnauthorized, "An access token is required.")
			return
		}
		token, err := v.Verify(r.Context(), raw)
		if err != nil {
			w.Header().Set("WWW-Authenticate", `Bearer error="invalid_token"`)
			problem.Error(w, r, http.StatusUnauthorized, "The access token is invalid or has expired.")
			return
		}
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), contextKey{}, token)))
	})
}

// fromHeader reads "Bearer <token>"; the scheme is case-insensitive (RFC 9110).
func fromHeader(h string) (string, bool) {
	scheme, token, ok := strings.Cut(h, " ")
	if !ok || !strings.EqualFold(scheme, "Bearer") {
		return "", false
	}
	token = strings.TrimSpace(token)
	return token, token != ""
}
