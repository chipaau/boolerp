// Package auth is the identity capability's authentication (C88, C91, C125): it
// accepts callers by Hydra access token and answers who is calling, resolving a
// person's token to their user through the identity module. It registers its
// own routes relative to its prefix (Routes); the edition mounts it at
// /api/auth. The default middleware (request ID, logging, recovery, origin
// checks) comes from the router it is mounted on; this package applies
// authentication itself, and other modules apply it with the Authenticate
// middleware the edition passes them.
package auth

import (
	"context"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/boolmv/erp/apps/api/internal/platform/authorization"
	"github.com/boolmv/erp/apps/api/internal/platform/identity"
)

// Module is the authentication module.
type Module struct {
	verifier tokenVerifier
	users    Users
	authz    authorization.Authorizer
	logger   *slog.Logger
}

// tokenVerifier checks an access token and returns what it says; *Verifier is the
// real one, and endpoint tests substitute their own (authentication is faked in
// endpoint tests, docs/testing.md).
type tokenVerifier interface {
	Verify(ctx context.Context, raw string) (Token, error)
}

// Users resolves a token's subject (a Kratos account) to its user, creating it
// on first use; the identity module implements it. A deleted or disabled
// account gets identity.ErrNoAccount, which Authenticate answers with 401.
type Users interface {
	Resolve(ctx context.Context, kratosIdentityID string) (identity.User, error)
}

// Caller is who a request is from: the verified token and, when the token is
// for a person (it has a subject), their user.
type Caller struct {
	Token Token
	User  *identity.User // nil for a client acting for itself
}

// Settings configure the module (from config.Auth).
type Settings struct {
	Issuer   string // Hydra's issuer, such as http://identity.bool.test/
	Audience string // the audience access tokens must include (erp-api)
}

// New returns the module. client fetches Hydra's keys; ctx bounds those
// fetches, so pass the application's lifetime context. Keys are fetched on first
// use, so the API starts and is ready while Hydra is down. users turns a
// token's subject into the user.
func New(ctx context.Context, s Settings, client *http.Client, users Users, authz authorization.Authorizer, logger *slog.Logger) *Module {
	return &Module{verifier: NewVerifier(ctx, s.Issuer, s.Audience, client), users: users, authz: authz, logger: logger}
}

// Routes registers the module's routes, relative to where it is mounted.
func (m *Module) Routes(r chi.Router) {
	r.Group(func(r chi.Router) {
		// Every route here asks Cerbos before it answers (C155).
		r.Use(m.Authenticate, authorization.Enforce(m.logger))
		r.Get("/me", m.me)
	})
}
