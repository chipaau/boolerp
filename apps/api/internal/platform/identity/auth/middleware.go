package auth

import (
	"errors"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5/middleware"

	"github.com/boolmv/erp/apps/api/internal/platform/identity"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/actor"

	"github.com/boolmv/erp/apps/api/internal/platform/kit/problem"
)

// Authenticate lets a request through only with a valid access token, and puts
// the caller (the token and, for a person, their user) in the request context
// (FromContext). Otherwise it answers 401 with WWW-Authenticate: Bearer (RFC
// 6750) and problem details; the token and the reason it failed are not echoed.
// A person who has not registered (POST /api/auth/me, C157) gets 401 too. It
// only reads: no request creates a user as a side effect. If the user cannot be
// loaded (the database unavailable), it answers 503. Every answer is marked not
// to be cached (chi's middleware.NoCache), since it is about the caller. Modules
// apply it to their own routes.
func (m *Module) Authenticate(next http.Handler) http.Handler {
	return m.authenticate(true, next)
}

// authenticateToken is Authenticate for POST /api/auth/me: a person without a
// user yet is let through (caller.User is nil), so they can register.
func (m *Module) authenticateToken(next http.Handler) http.Handler {
	return m.authenticate(false, next)
}

func (m *Module) authenticate(requireUser bool, next http.Handler) http.Handler {
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
			user, err := m.users.User(r.Context(), token.Subject)
			switch {
			case err == nil:
				caller.User = &user
			case errors.Is(err, identity.ErrNotFound):
				if requireUser {
					w.Header().Set("WWW-Authenticate", `Bearer error="invalid_token"`)
					problem.Error(w, r, http.StatusUnauthorized, "Register first: POST /api/auth/me.")
					return
				}
			default:
				m.logger.ErrorContext(r.Context(), "loading the caller's user failed", "error", err)
				problem.Error(w, r, http.StatusServiceUnavailable, "Your account could not be loaded. Try again shortly.")
				return
			}
		}
		next.ServeHTTP(w, r.WithContext(NewContext(r.Context(), caller)))
	}))
}

// RequireUser lets through only a person (C144): after Authenticate, a caller
// with a user. A machine client acting for itself gets 403.
func RequireUser(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if caller, ok := FromContext(r.Context()); !ok || caller.User == nil {
			problem.Error(w, r, http.StatusForbidden, "Only a signed-in person can do this.")
			return
		}
		next.ServeHTTP(w, r)
	})
}

// Actor puts the request's actor in its context for the audit (C147, C164): the
// person's user and the token's client, with the operation, request ID, and IP. It
// comes right after authentication; every transaction the request opens applies it.
func Actor(next http.Handler) http.Handler { return recordActor(next) }

var recordActor = actor.Middleware(func(r *http.Request) (userID, clientID string) {
	caller, ok := FromContext(r.Context())
	if !ok {
		return "", ""
	}
	if caller.User != nil {
		userID = caller.User.ID
	}
	return userID, caller.Token.ClientID
})

// fromHeader reads "Bearer <token>"; the scheme is case-insensitive (RFC 9110).
func fromHeader(h string) (string, bool) {
	scheme, token, ok := strings.Cut(h, " ")
	if !ok || !strings.EqualFold(scheme, "Bearer") {
		return "", false
	}
	token = strings.TrimSpace(token)
	return token, token != ""
}
