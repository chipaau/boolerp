package auth

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/boolmv/erp/apps/api/internal/platform/authorization"
	"github.com/boolmv/erp/apps/api/internal/platform/identity"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/problem"
)

// me answers who is calling (GET /api/auth/me): the signed-in user and the
// client the token was issued to. A client acting for itself has no user. Cerbos
// decides first: identity:user view of their own user, or identity:client view of
// itself (C154, C155). It only reads (C157).
func (m *Module) me(w http.ResponseWriter, r *http.Request) {
	caller, _ := FromContext(r.Context())

	// A person may see their own user; a machine client only itself (C154).
	res := authorization.Resource{Kind: "identity:client", ID: caller.Token.ClientID}
	if caller.User != nil {
		res = authorization.Resource{Kind: "identity:user", ID: caller.User.ID}
	}
	if err := m.authz.Check(r.Context(), "view", res); err != nil {
		authorization.WriteError(w, r, err)
		return
	}
	writeCaller(w, caller)
}

// register creates or updates the caller's user (POST /api/auth/me, C157) from
// Hydra's /userinfo, called with the caller's own access token: the email,
// phone, name, and picture the consent granted. The BFFs call it right after
// sign-in; other clients do the same. Calling it again only refreshes the user.
// Cerbos decides first: identity:account register of the caller's own account;
// a machine client acting for itself has no account and is denied. It answers
// like GET.
func (m *Module) register(w http.ResponseWriter, r *http.Request) {
	caller, _ := FromContext(r.Context())

	account := caller.Token.Subject
	if account == "" {
		account = caller.Token.ClientID // a client acting for itself: Cerbos denies it
	}
	if err := m.authz.Check(r.Context(), "register", authorization.Resource{Kind: "identity:account", ID: account}); err != nil {
		authorization.WriteError(w, r, err)
		return
	}

	// Authentication already read and verified the same header.
	raw, _ := fromHeader(r.Header.Get("Authorization"))
	user, err := m.users.Register(r.Context(), caller.Token.Subject, raw)
	switch {
	case err == nil:
	case errors.Is(err, identity.ErrInvalidAccount):
		w.Header().Set("WWW-Authenticate", `Bearer error="insufficient_scope", scope="openid email phone profile"`)
		problem.Error(w, r, http.StatusForbidden, "The access token must be granted the email and phone scopes.")
		return
	case errors.Is(err, identity.ErrTokenRefused), errors.Is(err, identity.ErrWrongAccount):
		if errors.Is(err, identity.ErrWrongAccount) {
			m.logger.WarnContext(r.Context(), "userinfo named another account than the token's subject")
		}
		w.Header().Set("WWW-Authenticate", `Bearer error="invalid_token"`)
		problem.Error(w, r, http.StatusUnauthorized, "The access token is invalid or has expired.")
		return
	default:
		m.logger.ErrorContext(r.Context(), "registering the caller's user failed", "error", err)
		problem.Error(w, r, http.StatusServiceUnavailable, "Your account could not be saved. Try again shortly.")
		return
	}
	caller.User = &user
	writeCaller(w, caller)
}

// writeCaller writes the caller as GET and POST /api/auth/me answer it.
func writeCaller(w http.ResponseWriter, caller Caller) {
	type user struct {
		ID          string `json:"id"`
		Email       string `json:"email"`
		Phone       string `json:"phone"`
		DisplayName string `json:"displayName,omitempty"`
		AvatarURL   string `json:"avatarUrl,omitempty"`
	}
	body := struct {
		User     *user  `json:"user"`
		ClientID string `json:"clientId"`
	}{ClientID: caller.Token.ClientID}
	if u := caller.User; u != nil {
		body.User = &user{ID: u.ID, Email: u.Email, Phone: u.Phone, DisplayName: u.DisplayName, AvatarURL: u.AvatarURL}
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(body)
}
