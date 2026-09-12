-- Global reference data — no tenant_id, not RLS-scoped. See docs/data-model/DB-FOUNDATION.md.
-- +goose Up

-- currencies — money columns across the system FK currencies.code.
CREATE TABLE currencies (
  code             char(3)     PRIMARY KEY,               -- ISO 4217 code ('MVR','USD') — natural key
  name             text        NOT NULL,                  -- English name ('Maldivian Rufiyaa')
  symbol           text        NOT NULL,                  -- Display symbol ('Rf','$')
  decimal_places   smallint    NOT NULL DEFAULT 2,        -- Fraction digits for formatting/rounding
  symbol_position  text        NOT NULL DEFAULT 'before', -- 'before' | 'after' the amount
  active_from      timestamptz NOT NULL DEFAULT now(),
  active_to        timestamptz,                            -- retired; NULL = still active
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_currencies_symbol_position CHECK (symbol_position IN ('before','after')),
  CONSTRAINT chk_currencies_active_order    CHECK (active_to IS NULL OR active_to >= active_from)
);

-- countries — ~196 real ISO 3166-1 countries seeded. tenants.country FKs this.
CREATE TABLE countries (
  code            char(2)     PRIMARY KEY,            -- ISO 3166-1 alpha-2 ('MV','US') — natural key
  name            text        NOT NULL,               -- canonical/operational name (English)
  name_i18n       jsonb       NOT NULL DEFAULT '{}',  -- local-script name for DOCUMENT GENERATION only, e.g. {"dv": "..."} — sparse, populate as needed
  dial_code       text        NOT NULL,               -- international dialing prefix ('+960')
  active_from     timestamptz NOT NULL DEFAULT now(),
  active_to       timestamptz,                        -- retired; NULL = still active
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_countries_active_order CHECK (active_to IS NULL OR active_to >= active_from)
);

-- geography_levels — per-country level taxonomy. country_code NULL = global default set
-- (fallback for any country without its own). Resolution: a country's own rows if any, else global.
CREATE TABLE geography_levels (
  id            uuid        PRIMARY KEY DEFAULT uuidv7(),
  country_code  char(2)     REFERENCES countries(code),  -- NULL = GLOBAL default level; non-null = country override
  level_no      smallint    NOT NULL,                     -- 1 = first level below the country node
  code          text        NOT NULL,                     -- machine key ('region','district','city' | 'atoll','island','ward')
  name          text        NOT NULL,                     -- display label (drives address-form field names)
  active_from   timestamptz NOT NULL DEFAULT now(),
  active_to     timestamptz,                               -- retired; NULL = still active
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_geo_levels_no    UNIQUE NULLS NOT DISTINCT (country_code, level_no),
  CONSTRAINT uq_geo_levels_code  UNIQUE NULLS NOT DISTINCT (country_code, code),
  CONSTRAINT chk_geo_levels_active_order CHECK (active_to IS NULL OR active_to >= active_from)
);

-- geographies — single GLOBAL location hierarchy. Country nodes at the top (level_id NULL),
-- sub-national nodes below. Dense for Maldives; sparse elsewhere (country node + free-text).
CREATE TABLE geographies (
  id            uuid        PRIMARY KEY DEFAULT uuidv7(),
  tree_key      bigint      NOT NULL UNIQUE,                        -- immutable ltree label (UUIDs can't be labels)
  parent_id     uuid        REFERENCES geographies(id),            -- adjacency; NULL for a country-root node
  path          ltree       NOT NULL,                              -- global materialised path of tree_keys; GiST-indexed
  level_id      uuid        REFERENCES geography_levels(id),       -- the level (global or country-specific); NULL only for the country root
  country_code  char(2)     NOT NULL REFERENCES countries(code),   -- country this node belongs to; denormalised on every node
  code          text,                                              -- admin/reference code (nullable)
  name          text        NOT NULL,                              -- canonical/operational name (English)
  name_i18n     jsonb       NOT NULL DEFAULT '{}',                 -- local-script name for DOCUMENT GENERATION only, e.g. {"dv": "..."} — sparse, populate as needed
  active_from   timestamptz NOT NULL DEFAULT now(),
  active_to     timestamptz,                                        -- retired; NULL = still active
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_geo_country_root CHECK ((parent_id IS NULL) = (level_id IS NULL)),  -- country root ⇔ no level
  CONSTRAINT chk_geographies_active_order CHECK (active_to IS NULL OR active_to >= active_from)
);
CREATE INDEX ON geographies USING GIST (path);   -- subtree/ancestor (per-country = subtree of its country node)
CREATE INDEX ON geographies (country_code);
CREATE INDEX ON geographies (parent_id);

-- +goose Down
DROP TABLE IF EXISTS geographies;
DROP TABLE IF EXISTS geography_levels;
DROP TABLE IF EXISTS countries;
DROP TABLE IF EXISTS currencies;
