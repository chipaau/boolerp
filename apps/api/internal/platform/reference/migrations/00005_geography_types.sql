-- Geography types (C215; fields confirmed 2026-10-16): the levels of a country's
-- addresses, such as the Maldives' atoll or city (1), island (2), and ward (3), or a US
-- state (1) and city (2). Several types may share a level. A level offers a picker where
-- places of it are listed (geographies) under the chosen place above it, and a text field
-- otherwise, so no flag says which. Global reference data, not tenant-scoped. The schema
-- only: the rows are a seed file.

-- +goose Up
CREATE TABLE geography_types (
    id          uuid        PRIMARY KEY DEFAULT uuidv7(),
    country     char(2)     NOT NULL REFERENCES countries (code) ON DELETE RESTRICT,
    code        text        NOT NULL CHECK (code ~ '^[a-z][a-z0-9_]{1,49}$'),
    name        text        NOT NULL CHECK (btrim(name) <> ''),  -- the form's label
    level       smallint    NOT NULL CHECK (level BETWEEN 1 AND 9),  -- 1: under the country
    active_from timestamptz NOT NULL DEFAULT now(),
    active_to   timestamptz CHECK (active_to >= active_from),  -- retired; null = in use
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE (country, code),
    -- The target of a two-column foreign key (type_id, country): a place has a type of
    -- its own country.
    UNIQUE (id, country)
);

CREATE TRIGGER geography_types_updated_at BEFORE UPDATE ON geography_types
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Everyone reads; until the operator write rule exists there is no write policy, so only
-- the owning migration role maintains them (migrations, deploy), as for legal_forms.
ALTER TABLE geography_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY geography_types_read ON geography_types FOR SELECT USING (true);

-- Every change is audited (C164).
SELECT audit.enable('geography_types');
