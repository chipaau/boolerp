package login

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"time"

	"github.com/coreos/go-oidc/v3/oidc"
	ory "github.com/ory/client-go"

	"github.com/boolmv/erp/apps/api/internal/platform/kit/problem"
)

// backchannelLogoutEvent is the event a back-channel logout token carries
// (OpenID Connect Back-Channel Logout 1.0, section 2.4).
const backchannelLogoutEvent = "http://schemas.openid.net/event/backchannel-logout"

// logoutTokenMaxAge bounds how old a back-channel logout token may be.
const logoutTokenMaxAge = 5 * time.Minute

// logout signs the browser out everywhere (C101): POST /auth/logout ends this
// BFF session and revokes its refresh token, then sends the browser to Hydra's
// logout, which ends the Hydra and Kratos sessions and notifies the other
// clients of that login (back-channel logout). Hydra returns the browser to this
// domain's home page. It is POST, so another site cannot sign people out.
func (h *Handler) logout(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	in, ok, err := h.sessions.Current(ctx)
	if err != nil {
		h.logger.ErrorContext(ctx, "logout: loading the session failed", "error", err)
		problem.Error(w, r, http.StatusServiceUnavailable, "Sign-out is unavailable right now.")
		return
	}
	if !ok {
		http.Redirect(w, r, "/", http.StatusSeeOther)
		return
	}
	if err := h.sessions.SignOut(ctx); err != nil {
		h.logger.ErrorContext(ctx, "logout: ending the session failed", "error", err)
		problem.Error(w, r, http.StatusServiceUnavailable, "Sign-out is unavailable right now.")
		return
	}
	// Hydra's logout revokes the login's tokens too; this makes sure the refresh
	// token is dead even if the browser never reaches Hydra, or Hydra's discovery
	// cannot be read below.
	h.revoke(ctx, in.Tokens.Refresh)

	p, err := h.discover(ctx)
	if err != nil {
		// The BFF session is gone; Hydra's and Kratos's end when they expire.
		h.logger.WarnContext(ctx, "logout: discovery failed; signed out of this app only", "error", err)
		http.Redirect(w, r, "/", http.StatusSeeOther)
		return
	}
	var endpoints struct {
		EndSession string `json:"end_session_endpoint"`
	}
	if err := p.Claims(&endpoints); err != nil || endpoints.EndSession == "" {
		h.logger.WarnContext(ctx, "logout: no end_session_endpoint; signed out of this app only")
		http.Redirect(w, r, "/", http.StatusSeeOther)
		return
	}
	q := url.Values{
		"id_token_hint":            {in.Tokens.IDToken},
		"post_logout_redirect_uri": {h.scheme() + "://" + r.Host + "/"},
	}
	h.logger.InfoContext(ctx, "signed out", "account", in.Account)
	// The target is Hydra's end_session_endpoint from its discovery document; the
	// return address is checked by Hydra against the client's registered ones.
	http.Redirect(w, r, endpoints.EndSession+"?"+q.Encode(), http.StatusSeeOther) //nolint:gosec // G710: see above
}

// revoke revokes a refresh token at Hydra (RFC 7009) with ory/client-go.
// Failures are logged: the session is already gone.
func (h *Handler) revoke(ctx context.Context, refreshToken string) {
	if refreshToken == "" {
		return
	}
	cfg := ory.NewConfiguration()
	cfg.Servers = ory.ServerConfigurations{{URL: h.settings.Issuer}}
	cfg.HTTPClient = h.client
	ctx = context.WithValue(ctx, ory.ContextBasicAuth, ory.BasicAuth{
		UserName: h.settings.ClientID, Password: h.settings.ClientSecret,
	})
	resp, err := ory.NewAPIClient(cfg).OAuth2API.RevokeOAuth2Token(ctx).Token(refreshToken).Execute()
	if resp != nil {
		_ = resp.Body.Close()
	}
	if err != nil {
		h.logger.WarnContext(ctx, "logout: revoking the refresh token failed", "error", errors.New("revocation endpoint refused or unreachable"))
	}
}

// backchannelLogout receives Hydra's back-channel logout (C101): POST
// /auth/backchannel-logout with a logout token, a JWT signed by Hydra for this
// client and naming the login session (sid) that ended. Every session of this
// BFF from that login is signed out. Answers 200, or 400 for an invalid token.
func (h *Handler) backchannelLogout(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	w.Header().Set("Cache-Control", "no-store")
	raw := r.PostFormValue("logout_token")
	if raw == "" {
		problem.Error(w, r, http.StatusBadRequest, "A logout token is required.")
		return
	}
	if _, err := h.discover(ctx); err != nil {
		h.logger.WarnContext(ctx, "back-channel logout: discovery failed", "error", err)
		problem.Error(w, r, http.StatusServiceUnavailable, "")
		return
	}
	// Signature (Hydra's keys), issuer, and audience (this client). A logout token
	// may have no expiry, so its age is checked from iat below.
	token, err := h.verifier(&oidc.Config{ClientID: h.settings.ClientID, SkipExpiryCheck: true}).
		Verify(oidc.ClientContext(ctx, h.client), raw)
	if err != nil {
		h.logger.WarnContext(ctx, "back-channel logout: token rejected", "error", err)
		problem.Error(w, r, http.StatusBadRequest, "The logout token is invalid.")
		return
	}
	var claims struct {
		SID    string                     `json:"sid"`
		Nonce  *string                    `json:"nonce"`
		Events map[string]json.RawMessage `json:"events"`
	}
	if err := token.Claims(&claims); err != nil || claims.SID == "" || claims.Nonce != nil ||
		claims.Events[backchannelLogoutEvent] == nil || time.Since(token.IssuedAt) > logoutTokenMaxAge {
		h.logger.WarnContext(ctx, "back-channel logout: not a valid logout token")
		problem.Error(w, r, http.StatusBadRequest, "The logout token is invalid.")
		return
	}
	if err := h.sessions.EndHydraSession(ctx, claims.SID); err != nil {
		h.logger.ErrorContext(ctx, "back-channel logout: ending sessions failed", "error", err)
		problem.Error(w, r, http.StatusServiceUnavailable, "")
		return
	}
	h.logger.InfoContext(ctx, "signed out by back-channel logout", "account", token.Subject)
	w.WriteHeader(http.StatusOK)
}

func (h *Handler) scheme() string {
	if h.settings.HTTPS {
		return "https"
	}
	return "http"
}
