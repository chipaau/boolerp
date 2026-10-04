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
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/coreos/go-oidc/v3/oidc"
	"github.com/go-chi/chi/v5"
	"golang.org/x/oauth2"
	"golang.org/x/sync/singleflight"

	"github.com/boolmv/erp/apps/api/internal/bff/session"
	"github.com/boolmv/erp/apps/api/internal/platform/identity/auth"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/problem"
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
	// RegisterURL is the API's POST /api/auth/me, called right after sign-in to
	// create or update the person's user (C157).
	RegisterURL string
}

// Handler serves /auth/login, /auth/callback, /auth/logout, and
// /auth/backchannel-logout.
type Handler struct {
	settings Settings
	sessions *session.Sessions
	logger   *slog.Logger
	client   *http.Client // Hydra
	api      *http.Client // the API, for RegisterURL

	// Hydra's discovery is read on the first login, not at startup, so the BFF
	// starts while Hydra is down. mu guards provider and keys only briefly;
	// flight makes concurrent first callers share one fetch.
	mu       sync.Mutex
	flight   singleflight.Group
	provider *oidc.Provider
	keys     oidc.KeySet // Hydra's signing keys, downloads limited (auth.KeyClient)
}

// New returns the login handler. client makes the requests to Hydra (discovery,
// keys, token exchange).
func New(s Settings, sessions *session.Sessions, client, api *http.Client, logger *slog.Logger) *Handler {
	return &Handler{settings: s, sessions: sessions, logger: logger, client: client, api: api}
}

// Routes registers the handlers relative to Prefix; they need the session
// middleware around them.
func (h *Handler) Routes(r chi.Router) {
	r.Get("/login", h.login)
	r.Get("/callback", h.callback)
	r.Post("/logout", h.logout)
	r.Post("/backchannel-logout", h.backchannelLogout)
}

// discover returns Hydra's provider, reading its discovery document once it
// succeeds. The lock is never held during the fetch: concurrent callers share
// one fetch (singleflight), and a failure is not remembered, so the next
// request tries again instead of every request queueing behind one slow call.
func (h *Handler) discover(ctx context.Context) (*oidc.Provider, error) {
	h.mu.Lock()
	p := h.provider
	h.mu.Unlock()
	if p != nil {
		return p, nil
	}
	v, err, _ := h.flight.Do("discover", func() (any, error) {
		return h.fetchProvider(ctx)
	})
	if err != nil {
		return nil, err
	}
	return v.(*oidc.Provider), nil
}

// fetchProvider reads Hydra's discovery document and keeps the provider and its
// key set. The first caller's cancellation does not end the shared fetch.
func (h *Handler) fetchProvider(ctx context.Context) (*oidc.Provider, error) {
	ctx, cancel := context.WithTimeout(oidc.ClientContext(context.WithoutCancel(ctx), h.client), 10*time.Second)
	defer cancel()
	p, err := oidc.NewProvider(ctx, h.settings.Issuer)
	if err != nil {
		return nil, err
	}
	var doc struct {
		JWKS string `json:"jwks_uri"`
	}
	if err := p.Claims(&doc); err != nil || doc.JWKS == "" {
		return nil, errors.New("login: Hydra's discovery document has no jwks_uri")
	}
	// The provider's own key set downloads the keys again for every token that
	// does not verify; this one is limited, since back-channel logout tokens come
	// from anyone who can reach the BFF.
	keys := oidc.NewRemoteKeySet(oidc.ClientContext(context.Background(), auth.KeyClient(h.client)), doc.JWKS)
	h.mu.Lock()
	h.keys, h.provider = keys, p
	h.mu.Unlock()
	return p, nil
}

// verifier checks tokens Hydra issued to this client, with h.keys; discover
// must have succeeded.
func (h *Handler) verifier(cfg *oidc.Config) *oidc.IDTokenVerifier {
	h.mu.Lock()
	defer h.mu.Unlock()
	return oidc.NewVerifier(h.settings.Issuer, h.keys, cfg)
}

// oauth2Config is the client for the domain the request arrived on. Hydra only
// accepts callbacks registered for the client, so a forged Host cannot redirect
// the login elsewhere.
func (h *Handler) oauth2Config(p *oidc.Provider, callback string) *oauth2.Config {
	endpoint := p.Endpoint()
	// The clients use client_secret_basic. x/oauth2's default auto-detection
	// retries a refused request with the secret in the body, which Hydra answers
	// with invalid_client, hiding the real error (such as invalid_grant).
	endpoint.AuthStyle = oauth2.AuthStyleInHeader
	return &oauth2.Config{
		ClientID:     h.settings.ClientID,
		ClientSecret: h.settings.ClientSecret,
		Endpoint:     endpoint,
		RedirectURL:  callback,
		// offline: Hydra issues a refresh token, so the session outlives the
		// 10-minute access token. email, phone, and profile: the person's details
		// in the ID token and from /userinfo, never in the access token.
		Scopes: []string{oidc.ScopeOpenID, oidc.ScopeOfflineAccess, "email", "phone", "profile"},
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
	callback := h.scheme() + "://" + r.Host + CallbackPath
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
	idToken, err := h.verifier(&oidc.Config{ClientID: h.settings.ClientID}).Verify(exchangeCtx, rawIDToken)
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

	// The person's user is created or updated before the session exists, so the
	// app's first API request finds it (C157). Without it the tokens are useless
	// to this app, so the new refresh token is revoked and no session is made.
	if err := h.register(ctx, token.AccessToken); err != nil {
		h.logger.ErrorContext(ctx, "login failed: registering the user with the API", "error", err)
		h.revoke(ctx, token.RefreshToken)
		problem.Error(w, r, http.StatusBadGateway, "Sign-in could not be completed. Try again shortly.")
		return
	}

	// Signing in again over a live session: its refresh token is revoked here,
	// and SignIn deletes its tokens, so nothing of the old login stays usable.
	if prev, ok, err := h.sessions.Current(ctx); err == nil && ok {
		h.revoke(ctx, prev.Tokens.Refresh)
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

// register calls the API's POST /api/auth/me with the new access token, which
// creates or updates the person's user from Hydra's /userinfo (C157).
func (h *Handler) register(ctx context.Context, accessToken string) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, h.settings.RegisterURL, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	resp, err := h.api.Do(req)
	if err != nil {
		return fmt.Errorf("calling the API: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()
	_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 1<<16))
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("the API answered %d", resp.StatusCode)
	}
	return nil
}

// ErrRefreshRefused means Hydra refused the refresh token (invalid_grant): it
// was revoked, has expired, or was reused after the grace period. The session
// must sign in again (C98).
var ErrRefreshRefused = errors.New("login: refresh token refused")

// Refresh exchanges the session's refresh token for new tokens. Hydra rotates
// refresh tokens, so the result carries a new one; the ID token is kept when the
// response has none.
func (h *Handler) Refresh(ctx context.Context, old session.Tokens) (session.Tokens, error) {
	p, err := h.discover(ctx)
	if err != nil {
		return session.Tokens{}, fmt.Errorf("login: discovery: %w", err)
	}
	// A token without an access token is never valid, so the source refreshes.
	src := h.oauth2Config(p, "").TokenSource(oidc.ClientContext(ctx, h.client), &oauth2.Token{RefreshToken: old.Refresh})
	t, err := src.Token()
	if err != nil {
		var re *oauth2.RetrieveError
		if errors.As(err, &re) && re.ErrorCode == "invalid_grant" {
			return session.Tokens{}, ErrRefreshRefused
		}
		return session.Tokens{}, redactOAuth2(err)
	}
	tokens := session.Tokens{Access: t.AccessToken, Refresh: t.RefreshToken, IDToken: old.IDToken, Expiry: t.Expiry}
	if idToken, _ := t.Extra("id_token").(string); idToken != "" {
		tokens.IDToken = idToken
	}
	if tokens.Refresh == "" {
		tokens.Refresh = old.Refresh
	}
	return tokens, nil
}

// safeReturnTo accepts only a path on this site ("/settings"), so the login
// cannot be used to send someone to another site after signing in. url.Parse
// rejects control characters, which browsers strip from a redirect ("/\t/evil"
// would become "//evil"); a backslash is refused because browsers read "/\"
// as "//".
func safeReturnTo(path string) string {
	u, err := url.Parse(path)
	if err != nil || u.Scheme != "" || u.Host != "" || u.User != nil ||
		!strings.HasPrefix(path, "/") || strings.HasPrefix(path, "//") || strings.Contains(path, "\\") {
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
