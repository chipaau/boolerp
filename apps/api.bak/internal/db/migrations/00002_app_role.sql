-- Non-owner runtime role for the API (least-privilege: DML only, no DDL) — this caps the
-- blast radius of any app bug or SQL injection on the control-plane tables. The RLS-specific
-- enforcement (FORCE ROW LEVEL SECURITY, the visible-set policy, the CI coverage guard) lands
-- with the first tenant-scoped business table, not here.
--
-- Migrations run as the OWNER (erp); the API connects as erp_app. ALTER DEFAULT PRIVILEGES
-- is set BEFORE any table exists, so every table created by later migrations auto-grants DML to
-- erp_app. The dev password is set here; production overrides it out-of-band (ALTER ROLE from a
-- secret) and never commits a real password.
-- +goose Up
-- +goose StatementBegin
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'erp_app') THEN
    CREATE ROLE erp_app LOGIN PASSWORD 'erp_app';
  END IF;
END
$$;
-- +goose StatementEnd
GRANT USAGE ON SCHEMA public TO erp_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO erp_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO erp_app;

-- +goose Down
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE USAGE, SELECT ON SEQUENCES FROM erp_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM erp_app;
REVOKE USAGE ON SCHEMA public FROM erp_app;
-- +goose StatementBegin
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'erp_app') THEN
    DROP ROLE erp_app;
  END IF;
END
$$;
-- +goose StatementEnd
