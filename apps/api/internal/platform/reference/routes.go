package reference

import (
	"github.com/go-chi/chi/v5"

	"github.com/boolmv/erp/apps/api/internal/platform"
)

// Routes returns the reference lists' routes, relative to where the edition mounts
// them (/api/v1), behind the Authenticated chain: reference data is not sensitive,
// so any authenticated caller may read it, a person or a machine client (C199).
// Each resource's handler is in its own file (countries.go, legal_forms.go, …).
func (m *Module) Routes(s platform.Services) func(chi.Router) {
	return func(r chi.Router) {
		r.Group(func(r chi.Router) {
			r.Use(s.Authenticated...)
			r.Get("/countries", m.countries(s.Authz))
			r.Get("/legal-forms", m.legalForms(s.Authz))
			r.Get("/institution-types", m.institutionTypes(s.Authz))
		})
	}
}
