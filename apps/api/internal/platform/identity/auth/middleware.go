package auth

import (
	"context"
	"errors"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5/middleware"

	"github.com/boolmv/erp/apps/api/internal/platform/identity"

	"github.com/boolmv/erp/apps/api/internal/platform/kit/problem"
)

// Authenticate lets a request through only with a valid access token, and puts
// the caller (the token and, for a person, their user) in the request context
// (FromContext). Otherwise it answers 401 with WWW-Authenticate: Bearer (RFC
// 6750) and problem details; the token and the reason it failed are not echoed.
// If the user cannot be loaded (Kratos or the database unavailable on a first
// request), it answers 503. Every answer is marked not to be cached (chi's
// middleware.NoCache), since it is about the caller. Modules apply it to their
// own routes.
func (m *Module) Authenticate(next http.Handler) http.Handler {
	return middleware.NoCache(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
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
		caller := Caller{Token: token}
		if token.Subject != "" {
			user, err := m.users.Resolve(r.Context(), token.Subject)
			if errors.Is(err, identity.ErrNoAccount) {
				w.Header().Set("WWW-Authenticate", `Bearer error="invalid_token"`)
				problem.Error(w, r, http.StatusUnauthorized, "The account is not available.")
				return
			}
			if err != nil {
				m.logger.ErrorContext(r.Context(), "loading the caller's user failed", "error", err)
				problem.Error(w, r, http.StatusServiceUnavailable, "Your account could not be loaded. Try again shortly.")
				return
			}
			caller.User = &user
		}
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), contextKey{}, caller)))
	}))
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
