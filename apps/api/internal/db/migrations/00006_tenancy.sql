-- Tenancy — platform control-plane (cross-tenant; NOT under tenant RLS — the switcher + membership
-- resolution read across tenants). tenants = organisation-only (party_type must be organisation-class,
-- app-enforced). Hierarchy = adjacency (parent_id) + ltree path with immutable bigint tree_key label.
-- +goose Up

-- tenants — one row per legal entity in the hierarchy. Billing profile + seats deferred to component 08.
-- tree_key is allocated from a sequence, not MAX(tree_key)+1: that read-then-insert races, and two
-- concurrent provisions computed the same key until one died on the unique constraint. A sequence is
-- atomic and needs no lock or caller discipline (provisioning is not always inside a transaction).
--
-- tenancy.md's "never a Postgres sequence" rule is scoped to GAPLESS DOCUMENT numbering — invoices,
-- POs, IUL series — where a skipped number is a compliance problem. tree_key is an opaque, immutable
-- ltree label that is never displayed or counted, so a gap from a rolled-back provision costs nothing.
CREATE SEQUENCE tenant_tree_key_seq AS bigint START 1;

CREATE TABLE tenants (
  id                  uuid        PRIMARY KEY DEFAULT uuidv7(),
  slug                text        NOT NULL UNIQUE,             -- subdomain; immutable after go-live
  code                text        NOT NULL UNIQUE,             -- short official ref ('MCC','MOH'); used in document numbering + reports
  name                text        NOT NULL,                    -- canonical/operational name (English) — universal fallback, used throughout the app
  name_i18n           jsonb       NOT NULL DEFAULT '{}',       -- jurisdiction-required local-script legal name for DOCUMENT GENERATION only (e.g. {"dv": "..."} for MV) — which key a document uses is decided by the document template, not a tenant default; absent key falls back to `name`
  party_type_id       uuid        REFERENCES party_types(id),        -- LEGAL form (identity docs + oversight default). MUST be organisation-class (app-enforced). NULL until classified
  institution_type_id uuid        REFERENCES institution_types(id),  -- FUNCTION/sector (provisioning template). NULL until classified
  identity_type       text,                                    -- org identity doc type; validated vs party_type.allowed_identity_types ([] = none, e.g. Government)
  identity_number     text,                                    -- org identity number (company reg no, …); NULL where the type has none
  email               text,                                    -- tenant contact email
  phone               text,                                    -- tenant contact phone (international form)
  is_internal         boolean     NOT NULL DEFAULT false,      -- the ONE internal/operator tenant; resolves admin.bool.test's membership check; Cerbos is_internal_member reads this
  parent_id           uuid        REFERENCES tenants(id),      -- hierarchy parent; NULL for roots
  oversight           text,                                    -- 'subordinate' (auto aggregate) | 'affiliated' (mutual agreement). NULL iff parent_id NULL
  tree_key            bigint      NOT NULL UNIQUE DEFAULT nextval('tenant_tree_key_seq'),  -- immutable ltree label; see the sequence above
  path                ltree       NOT NULL,                    -- materialised hierarchy path of tree_keys; GiST-indexed
  country             char(2)     NOT NULL REFERENCES countries(code),
  timezone            text        NOT NULL DEFAULT 'Indian/Maldives',
  status              text        NOT NULL DEFAULT 'provisioning', -- 'provisioning'|'active'|'suspended'|'archived'
  active_from         timestamptz,                             -- became active; NULL while provisioning (same pattern as tenant_users.active_from)
  active_to           timestamptz,                             -- ceased being active; NULL = still active (replaces deleted_at)
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_tenants_oversight_pair CHECK ((parent_id IS NULL) = (oversight IS NULL)),
  CONSTRAINT chk_tenants_oversight_val  CHECK (oversight IS NULL OR oversight IN ('subordinate','affiliated')),
  CONSTRAINT chk_tenants_status         CHECK (status IN ('provisioning','active','suspended','archived')),
  CONSTRAINT chk_tenants_active_order   CHECK (active_to IS NULL OR active_to >= active_from)
);
CREATE UNIQUE INDEX uq_tenants_one_internal ON tenants ((is_internal)) WHERE is_internal;  -- at most ONE internal tenant
CREATE INDEX ON tenants USING GIST (path);
CREATE INDEX ON tenants (parent_id);
CREATE INDEX ON tenants (status);

-- tenant_users — membership. Lifecycle link → active_from/active_to (not deleted_at).
CREATE TABLE tenant_users (
  id          uuid        PRIMARY KEY DEFAULT uuidv7(),
  user_id     uuid        NOT NULL REFERENCES users(id),     -- the global identity
  tenant_id   uuid        NOT NULL REFERENCES tenants(id),   -- the tenant they belong to
  status      text        NOT NULL DEFAULT 'invited',        -- 'invited' | 'active' | 'disabled' (reversible block)
  is_owner    boolean     NOT NULL DEFAULT false,            -- singular account owner (bootstrap admin + billing/legal responsible + protected transfer)
  invited_by  uuid        REFERENCES users(id),              -- who invited; NULL for the provisioning-created owner
  active_from timestamptz,                                   -- membership became active; NULL while invited
  active_to   timestamptz,                                   -- membership ENDED (left / removed); NULL = current member
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_tenant_users_status CHECK (status IN ('invited','active','disabled'))
);
CREATE UNIQUE INDEX uq_tenant_users_member ON tenant_users (user_id, tenant_id) WHERE active_to IS NULL;             -- one live membership
CREATE UNIQUE INDEX uq_tenant_users_owner  ON tenant_users (tenant_id)          WHERE is_owner AND active_to IS NULL; -- one owner
CREATE INDEX ON tenant_users (tenant_id);   -- members of this tenant (Control Centre)
CREATE INDEX ON tenant_users (user_id);     -- tenants I belong to (switcher)

-- +goose Down
DROP TABLE IF EXISTS tenant_users;
DROP TABLE IF EXISTS tenants;
DROP SEQUENCE IF EXISTS tenant_tree_key_seq;
