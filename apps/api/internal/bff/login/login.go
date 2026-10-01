// Package login signs browsers in through Hydra (C88, C90, C96): the BFF is
// Hydra's confidential OpenID Connect client and completes the login on the
// domain the browser is on, so the session cookie belongs to that domain.
// golang.org/x/oauth2 builds the authorization request and exchanges the code
// (with PKCE), and github.com/coreos/go-oidc verifies the ID token. Hydra's
// tokens are kept sealed in the server-side session; they never reach the
// browser or the logs.
package login

import (
	"context"
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/coreos/go-oidc/v3/oidc"
	"github.com/go-chi/chi/v5"
	"golang.org/x/oauth2"

	"github.com/boolmv/erp/apps/api/internal/bff/session"
	"github.com/boolmv/erp/apps/api/internal/platform/problem"
)

// Prefix is where the BFF mounts these routes; /api/* belongs to the API (C96).
const Prefix = "/auth"

// CallbackPath is where Hydra returns the browser; each domain's
// https://<domain>/auth/callback is registered with the client (C96).
const CallbackPath = Prefix + "/callback"

// Session keys that live only between /auth/login and /auth/callback.
const (
	keyState    = "login.state"
	keyNonce    = "login.nonce"
	keyVerifier = "login.verifier"
	keyReturnTo = "login.return_to"
	keyCallback = "login.callback"
)

// Settings configure the client (from config.OIDCClient and config.Session).
type Settings struct {
	Issuer       string
	ClientID     string
	ClientSecret string // a secret: never logged
	Audience     string // requested for access tokens, so the API accepts them
	// HTTPS selects the callback scheme: https unless plain-HTTP development.
	HTTPS bool
}

// Handler serves /auth/login and /auth/callback.
type Handler struct {
	settings Settings
	sessions *session.Sessions
	logger   *slog.Logger
	client   *http.Client

	// Hydra's discovery is read on the first login, not at startup, so the BFF
	// starts while Hydra is down.
	mu       sync.Mutex
	provider *oidc.Provider
}

// New returns the login handler. client makes the requests to Hydra (discovery,
// keys, token exchange).
func New(s Settings, sessions *session.Sessions, client *http.Client, logger *slog.Logger) *Handler {
	return &Handler{settings: s, sessions: sessions, logger: logger, client: client}
}

// Routes registers the handlers relative to Prefix; they need the session
// middleware around them.
func (h *Handler) Routes(r chi.Router) {
	r.Get("/login", h.login)
	r.Get("/callback", h.callback)
}

// discover returns Hydra's provider, reading its discovery document once.
func (h *Handler) discover(ctx context.Context) (*oidc.Provider, error) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.provider != nil {
		return h.provider, nil
	}
	ctx, cancel := context.WithTimeout(oidc.ClientContext(ctx, h.client), 10*time.Second)
	defer cancel()
	p, err := oidc.NewProvider(ctx, h.settings.Issuer)
	if err != nil {
		return nil, err
	}
	h.provider = p
	return p, nil
}

// oauth2Config is the client for the domain the request arrived on. Hydra only
// accepts callbacks registered for the client, so a forged Host cannot redirect
// the login elsewhere.
func (h *Handler) oauth2Config(p *oidc.Provider, callback string) *oauth2.Config {
	return &oauth2.Config{
		ClientID:     h.settings.ClientID,
		ClientSecret: h.settings.ClientSecret,
		Endpoint:     p.Endpoint(),
		RedirectURL:  callback,
		// offline: Hydra issues a refresh token, so the session outlives the
		// 10-minute access token.
		Scopes: []string{oidc.ScopeOpenID, oidc.ScopeOfflineAccess},
	}
}

// login starts a login: GET /auth/login?return_to=/path. It remembers the
// state, nonce, PKCE verifier, and return path in the session, then sends the
// browser to Hydra.
func (h *Handler) login(w http.ResponseWriter, r *http.Request) {
	p, err := h.discover(r.Context())
	if err != nil {
		h.logger.WarnContext(r.Context(), "login unavailable: OpenID Connect discovery failed", "error", err)
		problem.Error(w, r, http.StatusServiceUnavailable, "Sign-in is unavailable right now.")
		return
	}
	scheme := "http"
	if h.settings.HTTPS {
		scheme = "https"
	}
	callback := scheme + "://" + r.Host + CallbackPath
	state, nonce, verifier := random(), random(), oauth2.GenerateVerifier()

	ctx := r.Context()
	h.sessions.Put(ctx, keyState, state)
	h.sessions.Put(ctx, keyNonce, nonce)
	h.sessions.Put(ctx, keyVerifier, verifier)
	h.sessions.Put(ctx, keyReturnTo, safeReturnTo(r.URL.Query().Get("return_to")))
	h.sessions.Put(ctx, keyCallback, callback)

	url := h.oauth2Config(p, callback).AuthCodeURL(state,
		oidc.Nonce(nonce), oauth2.S256ChallengeOption(verifier),
		oauth2.SetAuthURLParam("audience", h.settings.Audience))
	// The target is Hydra's authorization endpoint from its discovery document; the
	// only request-derived part, the callback built from the Host, is checked by
	// Hydra against the client's registered callbacks, so this cannot redirect
	// anywhere else.
	http.Redirect(w, r, url, http.StatusFound) //nolint:gosec // G710: see above
}

// callback completes a login: Hydra returns the browser with ?code=&state=.
func (h *Handler) callback(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	q := r.URL.Query()
	state := h.sessions.PopString(ctx, keyState)
	nonce := h.sessions.PopString(ctx, keyNonce)
	verifier := h.sessions.PopString(ctx, keyVerifier)
	returnTo := h.sessions.PopString(ctx, keyReturnTo)
	callback := h.sessions.PopString(ctx, keyCallback)

	// The state ties this callback to a login this browser started (CSRF).
	if state == "" || subtle.ConstantTimeCompare([]byte(state), []byte(q.Get("state"))) != 1 {
		problem.Error(w, r, http.StatusBadRequest, "This sign-in link is invalid or has expired. Start again.")
		return
	}
	if e := q.Get("error"); e != "" {
		// For example access_denied; Hydra's description is not echoed.
		h.logger.InfoContext(ctx, "login refused by the identity provider", "error", e)
		problem.Error(w, r, http.StatusForbidden, "Sign-in was not completed.")
		return
	}

	p, err := h.discover(ctx)
	if err != nil {
		h.logger.WarnContext(ctx, "login unavailable: OpenID Connect discovery failed", "error", err)
		problem.Error(w, r, http.StatusServiceUnavailable, "Sign-in is unavailable right now.")
		return
	}
	exchangeCtx := oidc.ClientContext(ctx, h.client)
	token, err := h.oauth2Config(p, callback).Exchange(exchangeCtx, q.Get("code"), oauth2.VerifierOption(verifier))
	if err != nil {
		h.logger.WarnContext(ctx, "login failed: code exchange", "error", redactOAuth2(err))
		problem.Error(w, r, http.StatusBadRequest, "Sign-in could not be completed. Start again.")
		return
	}
	rawIDToken, _ := token.Extra("id_token").(string)
	if rawIDToken == "" || token.RefreshToken == "" {
		h.logger.WarnContext(ctx, "login failed: the token response lacks an ID token or a refresh token")
		problem.Error(w, r, http.StatusBadGateway, "Sign-in could not be completed.")
		return
	}
	// Signature (Hydra's published keys), issuer, audience (this client), and expiry.
	idToken, err := p.Verifier(&oidc.Config{ClientID: h.settings.ClientID}).Verify(exchangeCtx, rawIDToken)
	if err != nil {
		h.logger.WarnContext(ctx, "login failed: ID token rejected", "error", err)
		problem.Error(w, r, http.StatusBadRequest, "Sign-in could not be completed. Start again.")
		return
	}
	if subtle.ConstantTimeCompare([]byte(idToken.Nonce), []byte(nonce)) != 1 {
		h.logger.WarnContext(ctx, "login failed: ID token nonce mismatch")
		problem.Error(w, r, http.StatusBadRequest, "Sign-in could not be completed. Start again.")
		return
	}
	var claims struct {
		SID string `json:"sid"`
	}
	if err := idToken.Claims(&claims); err != nil {
		h.logger.WarnContext(ctx, "login failed: ID token claims", "error", err)
		problem.Error(w, r, http.StatusBadGateway, "Sign-in could not be completed.")
		return
	}

	if err := h.sessions.SignIn(ctx, session.SignedIn{
		Account:      idToken.Subject,
		HydraSession: claims.SID,
		Tokens: session.Tokens{
			Access:  token.AccessToken,
			Refresh: token.RefreshToken,
			IDToken: rawIDToken,
			Expiry:  token.Expiry,
		},
	}); err != nil {
		h.logger.ErrorContext(ctx, "login failed: storing the session", "error", err)
		problem.Error(w, r, http.StatusServiceUnavailable, "Sign-in is unavailable right now.")
		return
	}
	h.logger.InfoContext(ctx, "signed in", "account", idToken.Subject)
	http.Redirect(w, r, returnTo, http.StatusFound)
}

// safeReturnTo accepts only a path on this site ("/settings"), so the login
// cannot be used to send someone to another site after signing in.
func safeReturnTo(path string) string {
	if !strings.HasPrefix(path, "/") || strings.HasPrefix(path, "//") || strings.ContainsAny(path, "\\\r\n") {
		return "/"
	}
	return path
}

// random returns 32 random bytes, base64url-encoded, for state and nonce.
func random() string {
	b := make([]byte, 32)
	_, _ = rand.Read(b) // crypto/rand.Read never fails (Go 1.24+)
	return base64.RawURLEncoding.EncodeToString(b)
}

// redactOAuth2 keeps the OAuth2 error code from a failed exchange but drops the
// response body, which could echo request details.
func redactOAuth2(err error) error {
	var re *oauth2.RetrieveError
	if errors.As(err, &re) {
		code := re.ErrorCode
		if code == "" {
			code = "unknown"
		}
		return errors.New("token endpoint: " + code)
	}
	return err
}
