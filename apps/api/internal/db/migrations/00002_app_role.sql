-- Non-owner runtime role for the API (least-privilege: DML only, no DDL) — this caps the
-- blast radius of any app bug or SQL injection on the control-plane tables. The RLS-specific
-- enforcement (FORCE ROW LEVEL SECURITY, the visible-set policy, the CI coverage guard) lands
-- with the first tenant-scoped business table, not here.
--
-- Migrations run as the OWNER (goerp); the API connects as goerp_app. ALTER DEFAULT PRIVILEGES
-- is set BEFORE any table exists, so every table created by later migrations auto-grants DML to
-- goerp_app. The dev password is set here; production overrides it out-of-band (ALTER ROLE from a
-- secret) and never commits a real password.
-- +goose Up
-- +goose StatementBegin
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'goerp_app') THEN
    CREATE ROLE goerp_app LOGIN PASSWORD 'goerp_app';
  END IF;
END
$$;
-- +goose StatementEnd
GRANT USAGE ON SCHEMA public TO goerp_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO goerp_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO goerp_app;

-- +goose Down
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE USAGE, SELECT ON SEQUENCES FROM goerp_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM goerp_app;
REVOKE USAGE ON SCHEMA public FROM goerp_app;
-- +goose StatementBegin
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'goerp_app') THEN
    DROP ROLE goerp_app;
  END IF;
END
$$;
-- +goose StatementEnd
