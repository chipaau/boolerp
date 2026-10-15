package tenancy

import (
	"context"
	"net/http"

	"github.com/go-chi/render"
	"github.com/jackc/pgx/v5"

	"github.com/boolmv/erp/apps/api/internal/platform/authorization"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/problem"
	"github.com/boolmv/erp/apps/api/internal/platform/tenancy/adapters/store"
	"github.com/boolmv/erp/apps/api/internal/platform/tenancy/tenant"
)

// The /api/v1/tenant resource (C162): the tenant a member's request is in.

// current answers which tenant the request is in (GET /api/v1/tenant, C162): its
// ID, code, name, and status, read in the tenant's own transaction. Cerbos decides
// first: tenancy:tenant view, which a member has for their own tenant (C153).
func (m *Module) current(authz authorization.Authorizer) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		t, err := m.currentTenant(r.Context())
		if err != nil {
			m.logger.ErrorContext(r.Context(), "reading the tenant failed", "error", err)
			problem.Unavailable(w, r)
			return
		}
		if err := authz.Check(r.Context(), "view", authorization.Resource{
			Kind: "tenancy:tenant", ID: t.ID,
			Attributes: map[string]any{"tenant_id": t.ID, "status": t.Status},
		}); err != nil {
			authorization.WriteError(w, r, err)
			return
		}
		render.JSON(w, r, struct {
			ID     string `json:"id"`
			Code   string `json:"code"`
			Name   string `json:"name"`
			Status string `json:"status"`
		}{t.ID, t.Code, t.Name, t.Status})
	}
}

// currentTenant reads the request's tenant in its own read-only transaction.
func (m *Module) currentTenant(ctx context.Context) (t store.Tenant, err error) {
	err = tenant.ReadTx(ctx, m.db, func(ctx context.Context, tx pgx.Tx) error {
		t, err = store.CurrentTenant(ctx, tx)
		return err
	})
	return t, err
}
