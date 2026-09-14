-- audit_log — immutable, append-only business audit trail (component 06). Distinct from technical
-- tracing/logging (component 07). Tenant-scoped: the first table to actually need the RLS
-- enforcement 00002_app_role.sql promised ("lands with the first tenant-scoped business table").
-- +goose Up
CREATE TABLE audit_log (
  id                uuid        PRIMARY KEY DEFAULT uuidv7(),
  tenant_id         uuid        NOT NULL REFERENCES tenants(id) DEFAULT current_setting('app.current_tenant')::uuid,
  actor_user_id     uuid        REFERENCES users(id),   -- who did it; NULL if system-initiated
  acting_as_user_id uuid        REFERENCES users(id),   -- FR-AUD-04: the subject being impersonated during a support session (actor_user_id stays the real operator). NULL in ordinary use — not wired yet, no impersonation feature exists.
  entity_type       text        NOT NULL,                -- e.g. 'tenant'; open vocabulary, app-validated (like role_capabilities.capability)
  entity_id         uuid        NOT NULL,
  action            text        NOT NULL,                -- e.g. 'create', 'suspend', 'reactivate', 'archive'
  payload           jsonb       NOT NULL,                -- changed-column diff for updates; full snapshot for create/delete (FR-AUD-03's "before/after")
  request_id        text,                                -- correlation id: the same id in the API's logs, traces, Cerbos's decision log and any error response the caller saw. NULL when no request drove the change (CLI provisioning, first-run)
  ip                inet,
  occurred_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON audit_log (tenant_id);
CREATE INDEX ON audit_log (entity_type, entity_id);
CREATE INDEX ON audit_log (actor_user_id);
CREATE INDEX ON audit_log (occurred_at);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log FORCE ROW LEVEL SECURITY;
CREATE POLICY audit_log_isolation ON audit_log
  USING      (tenant_id = ANY (current_setting('app.visible_tenants')::uuid[]))
  WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid);

-- Append-only (FR-AUD-01): DB-enforced, not just "no application code path happens to update/delete
-- it" — mirrors the four-eyes CHECK constraints already used elsewhere in this schema for hard
-- invariants, but a trigger is what it takes to reject UPDATE/DELETE outright.
-- +goose StatementBegin
CREATE OR REPLACE FUNCTION audit_log_reject_mutation() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only: % is not permitted', TG_OP USING ERRCODE = 'restrict_violation';
END;
$$;
-- +goose StatementEnd
CREATE TRIGGER trg_audit_log_append_only
BEFORE UPDATE OR DELETE ON audit_log
FOR EACH ROW EXECUTE FUNCTION audit_log_reject_mutation();

-- +goose Down
DROP TRIGGER IF EXISTS trg_audit_log_append_only ON audit_log;
DROP FUNCTION IF EXISTS audit_log_reject_mutation();
DROP TABLE IF EXISTS audit_log;
