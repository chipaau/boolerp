package tenancy

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/boolmv/erp/internal/audit"
	"github.com/boolmv/erp/internal/db/sqlc"
)

// ErrTenantNotFound means no tenant carries the requested id. Callers map it to 404.
var ErrTenantNotFound = errors.New("tenancy: tenant not found")

// IllegalTransitionError means the tenant exists but its current status doesn't permit the action —
// e.g. reactivating an archived tenant, whose lifecycle has ended (FR-TEN-03). Callers map it to 409;
// it carries the current status so the operator is told why, not just that it failed.
type IllegalTransitionError struct {
	Action string
	Status string
}

func (e *IllegalTransitionError) Error() string {
	return fmt.Sprintf("tenancy: cannot %s a tenant with status %q", e.Action, e.Status)
}

// transitionTenant runs apply inside a WithTenant-scoped transaction, then records a "before"/
// "after" status audit entry alongside it — atomically, so a status change is never left unaudited
// (FR-AUD-05) and an audit-write failure rolls the status change back too.
//
// apply's own query carries the legal-from-status guard (see tenancy.sql), so it returns no rows
// when the transition isn't allowed. Since the tenant was just read in this same transaction, "no
// rows from apply" can only mean the guard rejected it — which is what separates a 409 from a 404.
func transitionTenant(
	ctx context.Context, pool *pgxpool.Pool, tenantID, actorID pgtype.UUID, action string,
	apply func(ctx context.Context, q *sqlc.Queries) (sqlc.Tenant, error),
) (sqlc.Tenant, error) {
	var result sqlc.Tenant
	err := WithTenant(ctx, pool, tenantID, func(ctx context.Context, tx pgx.Tx) error {
		q := sqlc.New(tx)

		before, err := q.GetTenantByID(ctx, tenantID)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return ErrTenantNotFound
			}
			return fmt.Errorf("tenancy: %s: get before state: %w", action, err)
		}
		updated, err := apply(ctx, q)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return &IllegalTransitionError{Action: action, Status: before.Status}
			}
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
		return q.SetTenantStatus(ctx, sqlc.SetTenantStatusParams{
			ID: tenantID, CurrentStatus: "active", NewStatus: "suspended",
		})
	})
}

// ReactivateTenant reverses a suspension.
func ReactivateTenant(ctx context.Context, pool *pgxpool.Pool, tenantID, actorID pgtype.UUID) (sqlc.Tenant, error) {
	return transitionTenant(ctx, pool, tenantID, actorID, "reactivate", func(ctx context.Context, q *sqlc.Queries) (sqlc.Tenant, error) {
		return q.SetTenantStatus(ctx, sqlc.SetTenantStatusParams{
			ID: tenantID, CurrentStatus: "suspended", NewStatus: "active",
		})
	})
}

// ArchiveTenant is irreversible in this flat-CRUD pass (see ArchiveTenant's own query comment).
func ArchiveTenant(ctx context.Context, pool *pgxpool.Pool, tenantID, actorID pgtype.UUID) (sqlc.Tenant, error) {
	return transitionTenant(ctx, pool, tenantID, actorID, "archive", func(ctx context.Context, q *sqlc.Queries) (sqlc.Tenant, error) {
		return q.ArchiveTenant(ctx, tenantID)
	})
}
