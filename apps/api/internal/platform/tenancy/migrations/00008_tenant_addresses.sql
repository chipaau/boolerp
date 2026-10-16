-- A tenant's addresses (C215; fields confirmed 2026-10-16): its registered address (the
-- legal one, printed on invoices, C172) and, when it differs, its mailing address; no
-- mailing row means mail goes to the registered one. The place is the deepest one picked
-- from geographies; the levels typed rather than picked are in typed_places, keyed by
-- their type's code ({"city": "San Diego"}); the street part is text. Earlier versions
-- are the audit log's (C164). Part of the registry the operator maintains.

-- +goose Up
-- The shape of a typed_places column, the one check every address table uses: an object
-- of geography type codes to non-blank text. That its codes are the address country's
-- types, deeper than the place picked, needs data, so the use case checks it (C208).
-- +goose StatementBegin
CREATE FUNCTION is_typed_places(places jsonb) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    AS $$
        SELECT jsonb_typeof(places) = 'object' AND NOT EXISTS (
            SELECT 1 FROM jsonb_each(places) AS p (type_code, value)
            WHERE p.type_code !~ '^[a-z][a-z0-9_]{1,49}$'
               OR jsonb_typeof(p.value) <> 'string'
               OR btrim(p.value #>> '{}') = '')
    $$;
-- +goose StatementEnd

CREATE TABLE tenant_addresses (
    id           uuid         PRIMARY KEY DEFAULT uuidv7(),
    tenant_id    uuid         NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT,
    kind         text         NOT NULL CHECK (kind IN ('registered', 'mailing')),
    country      char(2)      NOT NULL REFERENCES countries (code) ON DELETE RESTRICT,
    geography_id uuid,        -- the deepest place picked; null where none is listed
    typed_places jsonb        NOT NULL DEFAULT '{}' CHECK (is_typed_places(typed_places)),
    line1        text         NOT NULL CHECK (btrim(line1) <> ''),  -- house or building, street
    line2        text         CHECK (btrim(line2) <> ''),           -- unit, floor, other
    postal_code  text         CHECK (btrim(postal_code) <> ''),     -- formats differ by country
    -- The address's own point (a map pin), not its place's centre.
    latitude     numeric(8,6) CHECK (latitude BETWEEN -90 AND 90),
    longitude    numeric(9,6) CHECK (longitude BETWEEN -180 AND 180),
    created_at   timestamptz  NOT NULL DEFAULT now(),
    updated_at   timestamptz  NOT NULL DEFAULT now(),
    CHECK ((latitude IS NULL) = (longitude IS NULL)),  -- both or neither
    UNIQUE (tenant_id, kind),
    -- The place is in the address's country.
    FOREIGN KEY (geography_id, country) REFERENCES geographies (id, country) ON DELETE RESTRICT
);

CREATE INDEX tenant_addresses_geography_id ON tenant_addresses (geography_id);

CREATE TRIGGER tenant_addresses_updated_at BEFORE UPDATE ON tenant_addresses
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- A tenant reads its own addresses; the operator tenant reads all and alone creates,
-- changes, and deletes them (deleting the mailing row sends mail to the registered one).
ALTER TABLE tenant_addresses ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_addresses_read ON tenant_addresses FOR SELECT
    USING (tenant_id = current_tenant_id() OR lookup.is_operator_tenant(current_tenant_id()));
CREATE POLICY tenant_addresses_create ON tenant_addresses FOR INSERT
    WITH CHECK (lookup.is_operator_tenant(current_tenant_id()));
CREATE POLICY tenant_addresses_update ON tenant_addresses FOR UPDATE
    USING (lookup.is_operator_tenant(current_tenant_id()))
    WITH CHECK (lookup.is_operator_tenant(current_tenant_id()));
CREATE POLICY tenant_addresses_delete ON tenant_addresses FOR DELETE
    USING (lookup.is_operator_tenant(current_tenant_id()));

-- Every change is audited (C164), with the tenant for its audit view.
SELECT audit.enable('tenant_addresses');
