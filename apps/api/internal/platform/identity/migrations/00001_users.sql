-- Users (C94): our record of each account, a projection of the Kratos account it
-- maps to: one person, one account, several verified e-mails (C230). Kratos stays the
-- source of truth for credentials, emails, and
-- verification; this keeps what joins, display, and search need. Global, not
-- tenant-scoped: a user exists without any membership. email, phone,
-- display_name, and avatar_url are personal data (never logged, cached by, or
-- traced). avatar_url is the address of the person's picture (the Kratos picture
-- trait): http(s) only, never blank.

-- +goose Up
CREATE TABLE users (
    id                 uuid        PRIMARY KEY DEFAULT uuidv7(),
    kratos_identity_id uuid        NOT NULL UNIQUE,
    -- The account's primary address (the first of its e-mail traits).
    email              text        NOT NULL,
    -- Every verified address of the account, lowercase (C230): invitations are matched and
    -- claimed against it. No uniqueness here: Kratos keeps each address on one account.
    emails             text[]      NOT NULL DEFAULT '{}'
                       CHECK (emails = lower(emails::text)::text[] AND '' <> ALL (emails)),
    phone              text        NOT NULL,
    display_name       text,
    avatar_url         text        CHECK (avatar_url ~ '^https?://' AND btrim(avatar_url) <> ''),
    created_at         timestamptz NOT NULL DEFAULT now(),
    updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX users_emails ON users USING gin (emails);

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

-- Every change is audited (C164).
SELECT audit.enable('users');
