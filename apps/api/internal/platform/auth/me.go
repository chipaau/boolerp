package auth

import (
	"encoding/json"
	"net/http"
)

// me answers who is calling (GET /api/auth/me): the signed-in user and the
// client the token was issued to. A client acting for itself has no user.
func (m *Module) me(w http.ResponseWriter, r *http.Request) {
	caller, _ := FromContext(r.Context())
	type user struct {
		ID          string `json:"id"`
		Email       string `json:"email"`
		Phone       string `json:"phone"`
		DisplayName string `json:"displayName,omitempty"`
	}
	body := struct {
		User     *user  `json:"user"`
		ClientID string `json:"clientId"`
	}{ClientID: caller.Token.ClientID}
	if u := caller.User; u != nil {
		body.User = &user{ID: u.ID, Email: u.Email, Phone: u.Phone, DisplayName: u.DisplayName}
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(body)
}
