// Package rls holds the tenant-scoped-transaction primitive used to satisfy Postgres RLS policies
// (SET LOCAL app.current_tenant / app.visible_tenants). It's its own tiny, dependency-free package
// (like internal/module, internal/respond) so both internal/tenancy and internal/auth can use it —
// internal/auth needs it too (BuildOperatorPrincipal's user_roles lookup is RLS-scoped), and
// internal/tenancy already depends on internal/auth, so auth importing tenancy for this would cycle.
package rls

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

// Beginner is satisfied by both *pgxpool.Pool (a fresh top-level transaction) and pgx.Tx (a nested
// savepoint within a transaction the caller already holds — e.g. a test's rolled-back fixture tx),
// so WithTenant works the same way regardless of which one it's given.
type Beginner interface {
	Begin(ctx context.Context) (pgx.Tx, error)
}

// WithTenant opens a transaction (or a savepoint, if db is already a pgx.Tx), sets
// app.current_tenant (+ a single-tenant app.visible_tenants) LOCAL to it — never leaking across a
// pooled/PgBouncer'd connection — then runs fn. Every handler and background job that touches
// tenant-scoped data goes through this (FR-FND-04).
func WithTenant(ctx context.Context, db Beginner, tenantID pgtype.UUID, fn func(ctx context.Context, tx pgx.Tx) error) error {
	tx, err := db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("rls: begin tx: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if err := SetCurrentTenant(ctx, tx, tenantID); err != nil {
		return err
	}
	if err := fn(ctx, tx); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// SetCurrentTenant is WithTenant's session-var setup, exported so callers managing their own
// transaction (tenancy.Provision, which also needs to write an audit_log row for the tenant it just
// created) can apply the same tenant-scoping without going through WithTenant's callback shape.
func SetCurrentTenant(ctx context.Context, tx pgx.Tx, tenantID pgtype.UUID) error {
	id := uuidString(tenantID)
	if _, err := tx.Exec(ctx,
		`SELECT set_config('app.current_tenant', $1, true), set_config('app.visible_tenants', $2, true)`,
		id, "{"+id+"}",
	); err != nil {
		return fmt.Errorf("rls: set current tenant: %w", err)
	}
	return nil
}

func uuidString(id pgtype.UUID) string {
	return uuid.UUID(id.Bytes).String()
}
