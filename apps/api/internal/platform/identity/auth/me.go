package auth

import (
	"encoding/json"
	"net/http"

	"github.com/boolmv/erp/apps/api/internal/platform/authorization"
)

// me answers who is calling (GET /api/auth/me): the signed-in user and the
// client the token was issued to. A client acting for itself has no user. Cerbos
// decides first: identity:user view of their own user, or identity:client view of
// itself (C154, C155).
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
