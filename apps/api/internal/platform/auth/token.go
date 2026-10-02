// This file verifies Hydra access tokens: JWTs sent as Authorization: Bearer,
// checked locally against the issuer's published keys (C91). go-oidc caches the
// keys, fetches them again when Hydra rotates them, and checks the signature,
// issuer, audience, and expiry; this adds refusing ID tokens.
package auth

import (
	"context"
	"net/http"
	"strings"
	"time"

	"github.com/coreos/go-oidc/v3/oidc"
)

// ClockSkew is how far a server's clock may lag Hydra's before a fresh token
// counts as expired (C91).
const ClockSkew = 30 * time.Second

// Token is what a verified access token says about the caller.
type Token struct {
	Subject  string   // the account ID (sub); empty for a client acting for itself
	ClientID string   // the OAuth2 client the token was issued to (such as bff-workspace)
	Scopes   []string // granted scopes (scp)
}

// Verifier checks access tokens.
type Verifier struct {
	verifier *oidc.IDTokenVerifier
}

// NewVerifier returns a verifier for tokens from issuer meant for audience. Keys are
// fetched from <issuer>.well-known/jwks.json on first use, with client, and
// cached; ctx bounds those fetches, so pass the application's lifetime context.
func NewVerifier(ctx context.Context, issuer, audience string, client *http.Client) *Verifier {
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

const errNotAccessToken = tokenError("auth: not an access token (no client_id)")

type contextKey struct{}

// FromContext returns the request's caller, if authenticated (set by
// Module.Authenticate).
func FromContext(ctx context.Context) (Caller, bool) {
	c, ok := ctx.Value(contextKey{}).(Caller)
	return c, ok
}
