-- Legal forms (C120, C136; fields confirmed 2026-10-04): what an organisation is in
-- law, per country, each naming the registration number its organisations carry (or
-- none). The global category is what cross-country rules attach to. Tenants pick one
-- of their own country's. Global reference data, not tenant-scoped. The schema only:
-- the lists are a seed file (reference/seeds/legal_forms.csv) that cmd/deploy loads.

-- +goose Up
CREATE TABLE legal_forms (
    id                uuid        PRIMARY KEY DEFAULT uuidv7(),
    country           char(2)     NOT NULL REFERENCES countries (code) ON DELETE RESTRICT,
    code              text        NOT NULL CHECK (code ~ '^[a-z][a-z0-9_]{1,49}$'),
    name              text        NOT NULL CHECK (btrim(name) <> ''),
    category          text        NOT NULL
                      CHECK (category IN ('government', 'private', 'non_profit', 'international')),
    identity_document text        CHECK (btrim(identity_document) <> ''),  -- null: carries none
    active_from       timestamptz NOT NULL DEFAULT now(),
    active_to         timestamptz CHECK (active_to >= active_from),  -- retired; null = offered
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now(),
    UNIQUE (country, code),
    -- The target of a two-column foreign key (legal_form_id, country): tenants pick a
    -- legal form of their own country (C136; added 2026-10-04).
    UNIQUE (id, country)
);

CREATE TRIGGER legal_forms_updated_at BEFORE UPDATE ON legal_forms
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Everyone reads; writes are for the operator tenant only (C120). Until that rule
-- exists there is no write policy, so the runtime role cannot change legal forms
-- (deny by default); the owning migration role maintains them (migrations, deploy).
ALTER TABLE legal_forms ENABLE ROW LEVEL SECURITY;
CREATE POLICY legal_forms_read ON legal_forms FOR SELECT USING (true);
