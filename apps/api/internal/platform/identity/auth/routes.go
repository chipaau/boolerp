package auth

import (
	"github.com/go-chi/chi/v5"

	"github.com/boolmv/erp/apps/api/internal/platform/authorization"
)

// Each resource's handlers are in its own file: /me in me.go, its photo in photo.go (C200).

// Routes registers the module's routes, relative to where it is mounted.
func (m *Module) Routes(r chi.Router) {
	r.Group(func(r chi.Router) {
		// Every route here asks Cerbos before it answers (C155).
		r.Use(m.Authenticate, Actor, authorization.Enforce(m.logger))
		r.Get("/me", m.me)
		r.Get("/me/portraits", m.portraits)
		r.Put("/me/photo", m.setPhoto)
	})
	r.Group(func(r chi.Router) {
		// Registering is the one route a person may call before they have a user.
		r.Use(m.authenticateToken, Actor, authorization.Enforce(m.logger))
		r.Post("/me", m.register)
	})
}
