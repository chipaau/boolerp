-- audit_log — append-only (DB-enforced via trg_audit_log_append_only). tenant_id is never passed
-- explicitly; it resolves from the column DEFAULT (current_setting('app.current_tenant')), so a
-- caller can only insert while running inside a tenancy.WithTenant-resolved transaction.

-- name: CreateAuditLogEntry :one
-- request_id ties the audited change to the request that made it — the same id in the API's logs,
-- its traces, Cerbos's decision log, and any error response the caller saw. NULL for changes with no
-- request behind them (CLI provisioning, first-run setup).
INSERT INTO audit_log (actor_user_id, entity_type, entity_id, action, payload, request_id)
VALUES ($1, $2, $3, $4, $5, sqlc.narg(request_id))
RETURNING *;
