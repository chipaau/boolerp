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

	// What the surrounding scope was set to, if anything. Empty at the top level (a fresh connection
	// from the pool); populated when db is already a pgx.Tx and this Begin made a savepoint inside it.
	var outerTenant, outerVisible string
	// COALESCE: the missing_ok form of current_setting returns NULL, not an empty string, when the
	// setting has never been applied on this connection.
	if err := tx.QueryRow(ctx, `
		SELECT COALESCE(current_setting('app.current_tenant', true), ''),
		       COALESCE(current_setting('app.visible_tenants', true), '')`,
	).Scan(&outerTenant, &outerVisible); err != nil {
		return fmt.Errorf("rls: read enclosing tenant scope: %w", err)
	}

	if err := SetCurrentTenant(ctx, tx, tenantID); err != nil {
		return err
	}
	if err := fn(ctx, tx); err != nil {
		return err
	}

	// Put the enclosing scope back before releasing the savepoint. set_config LOCAL is scoped to the
	// TRANSACTION, not the savepoint: a rollback (including to a savepoint) undoes it, but a release
	// does not — so a committed inner scope would leave the outer transaction running as this tenant
	// for everything that follows. That is a silent cross-tenant leak, and the type signatures invite
	// it: auth.DBTX accepts a pgx.Tx, so BuildOperatorPrincipal can be called inside another tenant's
	// transaction.
	if outerTenant != "" {
		if err := restoreTenantScope(ctx, tx, outerTenant, outerVisible); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

// restoreTenantScope re-applies a previously captured scope. Values come from current_setting on the
// same transaction, never from a caller.
func restoreTenantScope(ctx context.Context, tx pgx.Tx, tenant, visible string) error {
	if _, err := tx.Exec(ctx,
		`SELECT set_config('app.current_tenant', $1, true), set_config('app.visible_tenants', $2, true)`,
		tenant, visible,
	); err != nil {
		return fmt.Errorf("rls: restore enclosing tenant scope: %w", err)
	}
	return nil
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
