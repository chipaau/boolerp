package tenancy

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/Bool-Maldives/erp/internal/audit"
	"github.com/Bool-Maldives/erp/internal/db/sqlc"
)

// transitionTenant runs apply inside a WithTenant-scoped transaction, then records a "before"/
// "after" status audit entry alongside it — atomically, so a status change is never left unaudited
// (FR-AUD-05) and an audit-write failure rolls the status change back too.
func transitionTenant(
	ctx context.Context, pool *pgxpool.Pool, tenantID, actorID pgtype.UUID, action string,
	apply func(ctx context.Context, q *sqlc.Queries) (sqlc.Tenant, error),
) (sqlc.Tenant, error) {
	var result sqlc.Tenant
	err := WithTenant(ctx, pool, tenantID, func(ctx context.Context, tx pgx.Tx) error {
		q := sqlc.New(tx)

		before, err := q.GetTenantByID(ctx, tenantID)
		if err != nil {
			return fmt.Errorf("tenancy: %s: get before state: %w", action, err)
		}
		updated, err := apply(ctx, q)
		if err != nil {
			return fmt.Errorf("tenancy: %s: %w", action, err)
		}

		payload, err := json.Marshal(map[string]any{
			"before": map[string]string{"status": before.Status},
			"after":  map[string]string{"status": updated.Status},
		})
		if err != nil {
			return fmt.Errorf("tenancy: %s: marshal audit payload: %w", action, err)
		}
		if err := audit.Record(ctx, tx, audit.Entry{
			ActorUserID: actorID, EntityType: "tenant", EntityID: tenantID, Action: action, Payload: payload,
		}); err != nil {
			return fmt.Errorf("tenancy: %s: %w", action, err)
		}

		result = updated
		return nil
	})
	return result, err
}

// SuspendTenant blocks access (the tenant-resolution middleware already denies non-active tenants)
// without ending the tenant's lifecycle — reversible via ReactivateTenant.
func SuspendTenant(ctx context.Context, pool *pgxpool.Pool, tenantID, actorID pgtype.UUID) (sqlc.Tenant, error) {
	return transitionTenant(ctx, pool, tenantID, actorID, "suspend", func(ctx context.Context, q *sqlc.Queries) (sqlc.Tenant, error) {
		return q.SetTenantStatus(ctx, sqlc.SetTenantStatusParams{ID: tenantID, Status: "suspended"})
	})
}

// ReactivateTenant reverses a suspension.
func ReactivateTenant(ctx context.Context, pool *pgxpool.Pool, tenantID, actorID pgtype.UUID) (sqlc.Tenant, error) {
	return transitionTenant(ctx, pool, tenantID, actorID, "reactivate", func(ctx context.Context, q *sqlc.Queries) (sqlc.Tenant, error) {
		return q.SetTenantStatus(ctx, sqlc.SetTenantStatusParams{ID: tenantID, Status: "active"})
	})
}

// ArchiveTenant is irreversible in this flat-CRUD pass (see ArchiveTenant's own query comment).
func ArchiveTenant(ctx context.Context, pool *pgxpool.Pool, tenantID, actorID pgtype.UUID) (sqlc.Tenant, error) {
	return transitionTenant(ctx, pool, tenantID, actorID, "archive", func(ctx context.Context, q *sqlc.Queries) (sqlc.Tenant, error) {
		return q.ArchiveTenant(ctx, tenantID)
	})
}
