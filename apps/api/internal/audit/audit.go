// Package audit captures the immutable, append-only business audit trail (component 06) — distinct
// from technical tracing/logging (component 07). audit_log is DB-enforced append-only (a trigger
// rejects UPDATE/DELETE) and RLS-scoped, so a row can only be written inside a transaction where
// tenancy.WithTenant has resolved the current tenant.
package audit

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgtype"

	"github.com/boolmv/erp/internal/db/sqlc"
)

// Entry is one audit_log row's content, before FR-AUD-04 impersonation context or request
// correlation are wired (neither exists yet — see the migration's column comments).
type Entry struct {
	ActorUserID pgtype.UUID // NULL (zero value) if system-initiated
	EntityType  string
	EntityID    pgtype.UUID
	Action      string
	Payload     []byte // jsonb: changed-column diff for updates, full snapshot for create/delete
}

// Record inserts one audit_log row. db must be a transaction already running inside
// tenancy.WithTenant for the affected tenant — the row's tenant_id resolves from the column
// default, and the RLS WITH CHECK would reject a mismatched or absent current tenant.
func Record(ctx context.Context, db sqlc.DBTX, e Entry) error {
	if _, err := sqlc.New(db).CreateAuditLogEntry(ctx, sqlc.CreateAuditLogEntryParams{
		ActorUserID: e.ActorUserID,
		EntityType:  e.EntityType,
		EntityID:    e.EntityID,
		Action:      e.Action,
		Payload:     e.Payload,
	}); err != nil {
		return fmt.Errorf("audit: record: %w", err)
	}
	return nil
}
