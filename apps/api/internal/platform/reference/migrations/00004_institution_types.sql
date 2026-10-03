-- Institution types (C120, C136, C138; fields confirmed 2026-10-04): the specific kind
-- of organisation, each in one sector. A tenant has a primary type and any number of
-- additional ones. Global, with country-neutral names; not tenant-scoped. The schema
-- only: the list is a seed file (reference/seeds/institution_types.csv) loaded by
-- cmd/deploy and cmd/seed.

-- +goose Up
CREATE TABLE institution_types (
    code        text        PRIMARY KEY CHECK (code ~ '^[a-z][a-z0-9_]{1,49}$'),
    sector      text        NOT NULL REFERENCES sectors (code) ON DELETE RESTRICT,
    name        text        NOT NULL CHECK (btrim(name) <> ''),
    active_from timestamptz NOT NULL DEFAULT now(),
    active_to   timestamptz CHECK (active_to >= active_from),  -- retired; null = in use
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX institution_types_sector ON institution_types (sector);

CREATE TRIGGER institution_types_updated_at BEFORE UPDATE ON institution_types
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Everyone reads; writes are for the operator tenant only (C120). Until that rule
-- exists there is no write policy, so the runtime role cannot change them (deny by
-- default); the owning migration role maintains them (migrations, deploy, seed).
ALTER TABLE institution_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY institution_types_read ON institution_types FOR SELECT USING (true);
