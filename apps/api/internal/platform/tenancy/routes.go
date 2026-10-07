package tenancy

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/go-chi/chi/v5"

	"github.com/boolmv/erp/apps/api/internal/platform"
	"github.com/boolmv/erp/apps/api/internal/platform/authorization"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/httpinput"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/problem"
	"github.com/boolmv/erp/apps/api/internal/platform/tenancy/adapters/store"
	"github.com/boolmv/erp/apps/api/internal/platform/tenancy/tenant"
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
		})
	}
}

// list answers one page of tenants (GET /api/v1/tenants, C179) for operator staff:
// Cerbos decides first (tenancy:tenant list, which needs tenancy:tenant:view or :manage
// in the operator tenant, C153), then the parameters (C68, C69) are read and the page is
// read in the operator's own transaction.
func (m *Module) list(authz authorization.Authorizer) http.HandlerFunc {
	type item struct {
		ID            string    `json:"id"`
		Slug          string    `json:"slug"`
		Code          string    `json:"code"`
		Name          string    `json:"name"`
		Status        string    `json:"status"`
		Country       string    `json:"country"`
		ParentID      *string   `json:"parentId"`
		WorkspaceHost *string   `json:"workspaceHost"`
		CreatedAt     time.Time `json:"createdAt"`
	}
	return func(w http.ResponseWriter, r *http.Request) {
		if err := authz.Can(r.Context(), "list", "tenancy:tenant"); err != nil {
			authorization.WriteError(w, r, err)
			return
		}
		l, ok := httpinput.ParseList(w, r, store.TenantListSpec)
		if !ok {
			return
		}
		var tenants []store.TenantItem
		var total int
		err := tenant.ReadTx(r.Context(), m.db, func(ctx context.Context, tx pgx.Tx) (err error) {
			tenants, total, err = store.ListTenants(ctx, tx, l)
			return err
		})
		if err != nil {
			m.logger.ErrorContext(r.Context(), "listing tenants failed", "error", err)
			problem.Error(w, r, http.StatusServiceUnavailable, "The service is unavailable right now.")
			return
		}
		items := make([]item, len(tenants))
		for i, t := range tenants {
			items[i] = item{t.ID, t.Slug, t.Code, t.Name, t.Status, t.Country, t.ParentID, t.WorkspaceHost, t.CreatedAt}
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(struct {
			Items    []item `json:"items"`
			Page     int    `json:"page"`
			PageSize int    `json:"pageSize"`
			Total    int    `json:"total"`
		}{items, l.Page, l.PageSize, total})
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
