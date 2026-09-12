// Package tenancy implements the pooled + Postgres RLS tenancy mechanics decided in
// docs/adr/0001-tenancy-pooled-rls.md and specified in .claude/rules/tenancy.md: WithTenant sets a
// transaction-local current tenant, the RLS coverage guard fails closed if a business table lacks
// isolation, and the resolution middleware turns a request Host into an authorized tenant context.
package tenancy

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

// WithTenant opens a transaction, sets app.current_tenant (+ a single-tenant app.visible_tenants)
// LOCAL to it — never leaking across a pooled/PgBouncer'd connection — then runs fn. Every handler
// and background job that touches tenant-scoped data goes through this (FR-FND-04).
func WithTenant(ctx context.Context, pool *pgxpool.Pool, tenantID pgtype.UUID, fn func(ctx context.Context, tx pgx.Tx) error) error {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("tenancy: begin tx: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if err := setCurrentTenant(ctx, tx, tenantID); err != nil {
		return err
	}

	if err := fn(ctx, tx); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// setCurrentTenant is WithTenant's session-var setup, factored out so callers managing their own
// transaction (Provision, which also needs to write an audit_log row for the tenant it just
// created) can apply the same tenant-scoping without going through WithTenant's callback shape.
func setCurrentTenant(ctx context.Context, tx pgx.Tx, tenantID pgtype.UUID) error {
	id := uuidString(tenantID)
	if _, err := tx.Exec(ctx,
		`SELECT set_config('app.current_tenant', $1, true), set_config('app.visible_tenants', $2, true)`,
		id, "{"+id+"}",
	); err != nil {
		return fmt.Errorf("tenancy: set current tenant: %w", err)
	}
	return nil
}

func uuidString(id pgtype.UUID) string {
	return uuid.UUID(id.Bytes).String()
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
