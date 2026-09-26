// Package tenancy implements the pooled + Postgres RLS tenancy mechanics decided in
// docs/adr/0001-tenancy-pooled-rls.md and specified in .claude/rules/tenancy.md: WithTenant sets a
// transaction-local current tenant, the RLS coverage guard fails closed if a business table lacks
// isolation, and the resolution middleware turns a request Host into an authorized tenant context.
package tenancy

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/boolmv/erp/internal/rls"
)

// WithTenant re-exports rls.WithTenant so existing callers here (Provision, lifecycle.go) and in
// tests don't change — the mechanics live in internal/rls so internal/auth can use them too (see
// that package's doc comment for why).
func WithTenant(ctx context.Context, pool *pgxpool.Pool, tenantID pgtype.UUID, fn func(ctx context.Context, tx pgx.Tx) error) error {
	return rls.WithTenant(ctx, pool, tenantID, fn)
}

type ctxKey int

const tenantIDKey ctxKey = iota

// WithTenantID stores the resolved tenant id in the request context (set by Middleware.RequireTenant).
func WithTenantID(ctx context.Context, id pgtype.UUID) context.Context {
	return context.WithValue(ctx, tenantIDKey, id)
}

// TenantIDFrom retrieves the resolved tenant id, if any.
func TenantIDFrom(ctx context.Context) (pgtype.UUID, bool) {
	id, ok := ctx.Value(tenantIDKey).(pgtype.UUID)
	return id, ok
}
