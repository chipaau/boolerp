-- audit_log — append-only (DB-enforced via trg_audit_log_append_only). tenant_id is never passed
-- explicitly; it resolves from the column DEFAULT (current_setting('app.current_tenant')), so a
-- caller can only insert while running inside a tenancy.WithTenant-resolved transaction.

-- name: CreateAuditLogEntry :one
INSERT INTO audit_log (actor_user_id, entity_type, entity_id, action, payload)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;
