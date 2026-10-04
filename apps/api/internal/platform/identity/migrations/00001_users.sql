-- Users (C94): our record of each account, a projection of the Kratos account it
-- maps to. Kratos stays the source of truth for credentials, emails, and
-- verification; this keeps what joins, display, and search need. Global, not
-- tenant-scoped: a user exists without any membership. email, phone, and
-- display_name are personal data (never logged, cached by, or traced).

-- +goose Up
CREATE TABLE users (
    id                 uuid        PRIMARY KEY DEFAULT uuidv7(),
    kratos_identity_id uuid        NOT NULL UNIQUE,
    email              text        NOT NULL,
    phone              text        NOT NULL,
    display_name       text,
    created_at         timestamptz NOT NULL DEFAULT now(),
    updated_at         timestamptz NOT NULL DEFAULT now()
);

-- Users cannot be deleted by the API (security review 2026-10-03, C126). The runtime
-- role's default privileges include DELETE on every table; nothing in the API
-- deletes a user, and a person's record must survive for audit. Row-level security
-- allows reading, creating, and updating users (global, not tenant-scoped) and has
-- no DELETE policy, so a delete as the runtime role matches no rows. Enabled, not
-- forced: the owning migration role can still maintain the table.
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY users_read ON users FOR SELECT USING (true);
CREATE POLICY users_create ON users FOR INSERT WITH CHECK (true);
CREATE POLICY users_update ON users FOR UPDATE USING (true) WITH CHECK (true);
