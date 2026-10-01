package auth

import (
	"context"
	"net/http"
	"strings"

	"github.com/boolmv/erp/apps/api/internal/platform/problem"
)

// Authenticate lets a request through only with a valid access token, which it
// puts in the request context (FromContext). Otherwise it answers 401 with
// WWW-Authenticate: Bearer (RFC 6750) and problem details; the token and the
// reason it failed are not echoed. Modules apply it to their own routes.
func (m *Module) Authenticate(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		raw, ok := fromHeader(r.Header.Get("Authorization"))
		if !ok {
			w.Header().Set("WWW-Authenticate", `Bearer`)
			problem.Error(w, r, http.StatusUnauthorized, "An access token is required.")
			return
		}
		token, err := m.verifier.Verify(r.Context(), raw)
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
