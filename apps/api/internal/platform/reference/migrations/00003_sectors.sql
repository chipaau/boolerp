-- Sectors (C120, C136; fields confirmed 2026-10-04): the broad field an
-- organisation works in, following ISIC's sections; institution types refine each.
-- Global, with country-neutral names; not tenant-scoped. The schema only: the list
-- is a seed file (reference/seeds/sectors.csv) loaded by cmd/deploy and cmd/seed.

-- +goose Up
CREATE TABLE sectors (
    code        text        PRIMARY KEY CHECK (code ~ '^[a-z][a-z0-9_]{1,49}$'),
    name        text        NOT NULL CHECK (btrim(name) <> ''),
    active_from timestamptz NOT NULL DEFAULT now(),
    active_to   timestamptz CHECK (active_to >= active_from),  -- retired; null = in use
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER sectors_updated_at BEFORE UPDATE ON sectors
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Everyone reads; writes are for the operator tenant only (C120). Until that rule
-- exists there is no write policy, so the runtime role cannot change sectors (deny
-- by default); the owning migration role maintains them (migrations, deploy, seed).
ALTER TABLE sectors ENABLE ROW LEVEL SECURITY;
CREATE POLICY sectors_read ON sectors FOR SELECT USING (true);
