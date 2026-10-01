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
