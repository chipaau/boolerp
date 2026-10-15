package tenancy

import (
	"github.com/go-chi/chi/v5"

	"github.com/boolmv/erp/apps/api/internal/platform"
)

// Routes returns the module's routes, relative to where the edition mounts them
// (/api/v1/tenant), each protected by one of s's chains (C144).
func (m *Module) Routes(s platform.Services) func(chi.Router) {
	return func(r chi.Router) {
		r.Group(func(r chi.Router) {
			r.Use(s.TenantUser...)
			r.Get("/", m.current(s.Authz))
		})
	}
}

// TenantsRoutes returns the admin console's tenant routes, relative to where the edition
// mounts them (/api/v1/tenants), behind the Operator chain (C178).
func (m *Module) TenantsRoutes(s platform.Services) func(chi.Router) {
	return func(r chi.Router) {
		r.Group(func(r chi.Router) {
			r.Use(s.Operator...)
			r.Get("/", m.list(s.Authz))
			r.Post("/", m.create(s.Authz))
		})
	}
}
