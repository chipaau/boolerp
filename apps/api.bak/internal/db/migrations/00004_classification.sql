-- Global classification — no tenant_id. Two orthogonal dimensions a tenant carries:
-- party_types = legal form (identity docs); institution_types = function/sector (provisioning
-- template). Example: a private hospital = party_type Private Company + institution_type Hospital.
-- +goose Up

-- party_types — legal form. Country-scoped, ADDITIVE resolution (global NULL rows ∪ country rows).
-- Flat: no parent_id — no confirmed rule ever walks the tree (party_type_class + code are enough).
CREATE TABLE party_types (
  id                     uuid        PRIMARY KEY DEFAULT uuidv7(),
  country_code           char(2)     REFERENCES countries(code),   -- NULL = universal legal form; set = jurisdiction-specific ('llc' US, 'gmbh' DE)
  party_type_class       text        NOT NULL,                     -- 'individual' | 'organisation'
  code                   text        NOT NULL,                     -- stable key ('government','private-company','local')
  name                   text        NOT NULL,                     -- English label
  allowed_identity_types jsonb       NOT NULL DEFAULT '[]',        -- identity docs required ([] = none, e.g. Government)
  active_from            timestamptz NOT NULL DEFAULT now(),       -- seeded rows are active immediately — no pending state
  active_to              timestamptz,                              -- retired; NULL = still active
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_party_type_class         CHECK (party_type_class IN ('individual','organisation')),
  CONSTRAINT uq_party_types_code          UNIQUE NULLS NOT DISTINCT (country_code, code),
  CONSTRAINT chk_party_types_active_order CHECK (active_to IS NULL OR active_to >= active_from)
);
CREATE INDEX ON party_types (party_type_class);
CREATE INDEX ON party_types (country_code);

-- institution_types — function/sector. Selects the provisioning template (template_key is a STRING
-- selector resolved by the provisioning engine, NOT an FK). Country-scoped, additive.
CREATE TABLE institution_types (
  id            uuid        PRIMARY KEY DEFAULT uuidv7(),
  country_code  char(2)     REFERENCES countries(code),        -- NULL = global default; set = country-specific (MV 'council')
  code          text        NOT NULL,                          -- stable key ('ministry','council','hospital','health-centre','school','business')
  name          text        NOT NULL,                          -- English label
  template_key  text,                                          -- selects the provisioning template (blueprint of defaults); string selector, NULL = generic default
  is_active     boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_institution_types_code UNIQUE NULLS NOT DISTINCT (country_code, code)
);
CREATE INDEX ON institution_types (country_code);

-- +goose Down
DROP TABLE IF EXISTS institution_types;
DROP TABLE IF EXISTS party_types;
