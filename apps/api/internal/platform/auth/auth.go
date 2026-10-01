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
	"net/http"

	"github.com/go-chi/chi/v5"
)

// Module is the auth module.
type Module struct {
	verifier *Verifier
}

// Settings configure the module (from config.Auth).
type Settings struct {
	Issuer   string // Hydra's issuer, such as http://identity.bool.test/
	Audience string // the audience access tokens must include (erp-api)
}

// New returns the module. client fetches Hydra's keys; ctx bounds those
// fetches, so pass the application's lifetime context. Keys are fetched on first
// use, so the API starts and is ready while Hydra is down.
func New(ctx context.Context, s Settings, client *http.Client) *Module {
	return &Module{verifier: NewVerifier(ctx, s.Issuer, s.Audience, client)}
}

// Routes registers the module's routes, relative to where it is mounted.
func (m *Module) Routes(r chi.Router) {
	r.Group(func(r chi.Router) {
		r.Use(m.Authenticate)
		r.Get("/me", m.me)
	})
}
