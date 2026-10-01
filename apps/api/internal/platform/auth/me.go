package auth

import (
	"encoding/json"
	"net/http"
)

// me answers who the access token says is calling: the account and the client
// (GET /api/auth/me). The caller context of step 7d builds on it.
func (m *Module) me(w http.ResponseWriter, r *http.Request) {
	token, _ := FromContext(r.Context())
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(struct {
		Subject  string `json:"subject"`
		ClientID string `json:"clientId"`
	}{token.Subject, token.ClientID})
}
