// Package auth is the API's authentication module (C88, C91): it accepts
// callers by Hydra access token and answers who is calling. Like every module,
// it registers its own routes relative to its prefix (Routes); bootstrap only
// mounts it, at /api/auth. The default middleware (request ID, logging,
// recovery, origin checks) comes from the router it is mounted on; this module
// applies authentication itself, and other modules apply it with the
// Authenticate middleware bootstrap passes them.
package auth

import (
	"context"
	"errors"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"
)

// Module is the auth module.
type Module struct {
	verifier *Verifier
	resolve  ResolveUser
	logger   *slog.Logger
}

// User is the signed-in person, as the identity module records them (C94). auth
// does not import modules; the edition passes it a ResolveUser.
type User struct {
	ID          string // our user ID
	Email       string
	Phone       string
	DisplayName string
}

// ResolveUser returns the user for a token's subject (a Kratos account),
// creating it on first use. It returns ErrUnknownUser when the account is
// deleted or disabled and has no user.
type ResolveUser func(ctx context.Context, subject string) (User, error)

// ErrUnknownUser is what a ResolveUser returns for an account that cannot
// sign in; Authenticate answers 401 for it.
var ErrUnknownUser = errors.New("auth: the token's account is deleted or disabled")

// Caller is who a request is from: the verified token and, when the token is
// for a person (it has a subject), their user.
type Caller struct {
	Token Token
	User  *User // nil for a client acting for itself
}

// Settings configure the module (from config.Auth).
type Settings struct {
	Issuer   string // Hydra's issuer, such as http://identity.bool.test/
	Audience string // the audience access tokens must include (erp-api)
}

// New returns the module. client fetches Hydra's keys; ctx bounds those
// fetches, so pass the application's lifetime context. Keys are fetched on first
// use, so the API starts and is ready while Hydra is down. resolve turns a
// token's subject into the user.
func New(ctx context.Context, s Settings, client *http.Client, resolve ResolveUser, logger *slog.Logger) *Module {
	return &Module{verifier: NewVerifier(ctx, s.Issuer, s.Audience, client), resolve: resolve, logger: logger}
}

// Routes registers the module's routes, relative to where it is mounted.
func (m *Module) Routes(r chi.Router) {
	r.Group(func(r chi.Router) {
		r.Use(m.Authenticate)
		r.Get("/me", m.me)
	})
}
