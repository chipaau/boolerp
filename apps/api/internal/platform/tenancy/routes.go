package tenancy

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/boolmv/erp/apps/api/internal/platform"
	"github.com/boolmv/erp/apps/api/internal/platform/authorization"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/problem"
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

// current answers which tenant the request is in (GET /api/v1/tenant, C162): its
// ID, code, name, and status, read in the tenant's own transaction. Cerbos decides
// first: tenancy:tenant view, which a member has for their own tenant (C153).
func (m *Module) current(authz authorization.Authorizer) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		t, err := m.currentTenant(r.Context())
		if err != nil {
			m.logger.ErrorContext(r.Context(), "reading the tenant failed", "error", err)
			problem.Error(w, r, http.StatusServiceUnavailable, "The service is unavailable right now.")
			return
		}
		if err := authz.Check(r.Context(), "view", authorization.Resource{
			Kind: "tenancy:tenant", ID: t.ID,
			Attributes: map[string]any{"tenant_id": t.ID, "status": t.Status},
		}); err != nil {
			authorization.WriteError(w, r, err)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(struct {
			ID     string `json:"id"`
			Code   string `json:"code"`
			Name   string `json:"name"`
			Status string `json:"status"`
		}{t.ID, t.Code, t.Name, t.Status})
	}
}
