# DB — Foundation (Phase 1)

Confirmed foundation tables. **Pooled + RLS**, grain `tenant_id`. Global reference tables carry **no**
`tenant_id`; business tables carry `tenant_id` + the RLS visible-set policy. Conventions: UUID v7 PKs on
business tables, `timestamptz` times, bilingual `name`/`name_dv`, ltree + `tree_key` hierarchies. See
`.claude/rules/tenancy.md` + `conventions.md`.

> Built **table-by-table**, each explicitly approved by the user. No table is added without that.

---

## Reference data (global — no `tenant_id`, not RLS-scoped)

### `currencies` — ✅ approved 2026-08-13
Seeded (MVR, USD). Never hard-deleted (`is_active`). Money columns across the system FK `currencies.code`.

```sql
CREATE TABLE currencies (
  code             char(3)     PRIMARY KEY,               -- ISO 4217 code ('MVR','USD') — natural key
  name             text        NOT NULL,                  -- English name ('Maldivian Rufiyaa')
  name_dv          text        NOT NULL,                  -- Dhivehi (Thaana) name — bilingual pair
  symbol           text        NOT NULL,                  -- Display symbol ('Rf','$')
  decimal_places   smallint    NOT NULL DEFAULT 2,        -- Fraction digits for formatting/rounding
  symbol_position  text        NOT NULL DEFAULT 'before', -- 'before' | 'after' the amount
  is_active        boolean     NOT NULL DEFAULT true,     -- Soft-retire (reference rows never hard-deleted)
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_currencies_symbol_position CHECK (symbol_position IN ('before','after'))
);
```

### `countries` — ✅ approved 2026-08-13
~196 real ISO 3166-1 countries seeded. `tenants.country` FKs this. **No `pricelist_id` here** — that
billing column + FK is added in component 08 (billing), not 01.

```sql
CREATE TABLE countries (
  code            char(2)     PRIMARY KEY,            -- ISO 3166-1 alpha-2 ('MV','US') — natural key
  name            text        NOT NULL,               -- English name ('Maldives')
  name_dv         text        NOT NULL,               -- Dhivehi (Thaana) name
  dial_code       text        NOT NULL,               -- International dialing prefix ('+960')
  default_locale  text        NOT NULL DEFAULT 'en',  -- Default UI language for tenants here ('en'|'dv')
  is_active       boolean     NOT NULL DEFAULT true,  -- Soft-retire
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_countries_default_locale CHECK (default_locale IN ('en','dv'))
);
```

### `geography_levels` — ✅ approved 2026-08-13
Per-country level taxonomy. `country_code` **NULL = global default** (fallback for any country without
its own set). Resolution (app logic): a country's own rows if any exist, else the global rows — no mixing.

```sql
CREATE TABLE geography_levels (
  id            uuid        PRIMARY KEY DEFAULT uuidv7(),
  country_code  char(2)     REFERENCES countries(code),  -- NULL = GLOBAL default level; non-null = country override
  level_no      smallint    NOT NULL,                     -- 1 = first level below the country node
  code          text        NOT NULL,                     -- machine key ('region','district','city' | 'atoll','island','ward')
  name          text        NOT NULL,                     -- display label (drives address-form field names)
  name_dv       text,                                     -- Dhivehi label (MV only)
  is_active     boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_geo_levels_no   UNIQUE NULLS NOT DISTINCT (country_code, level_no),
  CONSTRAINT uq_geo_levels_code UNIQUE NULLS NOT DISTINCT (country_code, code)
);
-- Seed: global (NULL) → region/district/city; MV → atoll/island/ward.
```

### `geographies` — ✅ approved 2026-08-13
Single **global** location hierarchy. Country nodes at the top (`level_id NULL`), sub-national nodes below
(`level_id` → `geography_levels`). Dense for Maldives; sparse elsewhere (a foreign address = the country
node + free-text). `country_code` denormalised on every node.

```sql
CREATE TABLE geographies (
  id            uuid        PRIMARY KEY DEFAULT uuidv7(),
  tree_key      bigint      NOT NULL UNIQUE,                        -- immutable ltree label (UUIDs can't be labels)
  parent_id     uuid        REFERENCES geographies(id),            -- adjacency; NULL for a country-root node
  path          ltree       NOT NULL,                              -- global materialised path of tree_keys; GiST-indexed
  level_id      uuid        REFERENCES geography_levels(id),       -- the level (global or country-specific); NULL only for the country root
  country_code  char(2)     NOT NULL REFERENCES countries(code),   -- country this node belongs to; denormalised on every node
  code          text,                                              -- admin/reference code (nullable)
  name          text        NOT NULL,                              -- English name
  name_dv       text,                                              -- Dhivehi (Thaana) — nullable (MV only)
  is_active     boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_geo_country_root CHECK ((parent_id IS NULL) = (level_id IS NULL))  -- country root ⇔ no level
);
CREATE INDEX ON geographies USING GIST (path);   -- subtree/ancestor (per-country = subtree of its country node)
CREATE INDEX ON geographies (country_code);
CREATE INDEX ON geographies (parent_id);
```

---

## Classification (global — no `tenant_id`)

Two **orthogonal** dimensions: `party_types` = **legal form** (drives identity docs); `institution_types`
= **function/sector** (drives provisioning template). A tenant carries both. Example: a private hospital =
`party_type` Private Company + `institution_type` Hospital.

### `party_types` — legal form — ✅ approved 2026-08-13
Country-scoped, **additive** resolution (a country's effective set = global `NULL` rows ∪ its own rows).

```sql
CREATE TABLE party_types (
  id                     uuid        PRIMARY KEY DEFAULT uuidv7(),
  country_code           char(2)     REFERENCES countries(code),   -- NULL = universal legal form; set = jurisdiction-specific ('llc' US, 'gmbh' DE)
  parent_id              uuid        REFERENCES party_types(id),    -- tree edge; NULL for roots (Individual, Organisation)
  party_type_class       text        NOT NULL,                     -- 'individual' | 'organisation' — denormalised on every row
  code                   text        NOT NULL,                     -- stable key ('government','private-company','local')
  name                   text        NOT NULL,                     -- English label
  name_dv                text,                                     -- Dhivehi — nullable (foreign forms may have none)
  allowed_identity_types jsonb       NOT NULL DEFAULT '[]',        -- identity docs required ([] = none, e.g. Government)
  is_active              boolean     NOT NULL DEFAULT true,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_party_type_class CHECK (party_type_class IN ('individual','organisation')),
  CONSTRAINT uq_party_types_code  UNIQUE NULLS NOT DISTINCT (country_code, code)
);
CREATE INDEX ON party_types (parent_id);
CREATE INDEX ON party_types (party_type_class);
CREATE INDEX ON party_types (country_code);
-- Seed (global NULL): Individual→{Local,Foreign,Work Permit}; Organisation→{Government,NGO,Sole Proprietor,Company→{Public,Private},Partnership}.
```

### `institution_types` — function / sector — ✅ approved 2026-08-13
The *what an entity does* dimension; selects the provisioning template. Country-scoped, additive
(global `NULL` ∪ country rows). `tenants.institution_type_id` will reference it.

```sql
CREATE TABLE institution_types (
  id            uuid        PRIMARY KEY DEFAULT uuidv7(),
  country_code  char(2)     REFERENCES countries(code),        -- NULL = global default; set = country-specific (MV 'council')
  parent_id     uuid        REFERENCES institution_types(id),  -- optional grouping (Healthcare → {Hospital, Health Centre}); NULL = top-level
  code          text        NOT NULL,                          -- stable key ('ministry','council','hospital','health-centre','school','business')
  name          text        NOT NULL,                          -- English label
  name_dv       text,                                          -- Dhivehi label — nullable

  -- template_key selects the PROVISIONING TEMPLATE: the blueprint of defaults a newly-provisioned
  -- tenant of this kind is seeded with (org units, roles, site types, numbering series, and the
  -- terminology/vocabulary it uses). It is a STRING SELECTOR, not an FK — the blueprint lives in the
  -- provisioning engine (code + seed data), keyed by this value. Several institution types may share
  -- one template (Hospital + Clinic + Health Centre → 'health_facility'). NULL = the generic default
  -- template. See "Provisioning templates" below.
  template_key  text,

  is_active     boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_institution_types_code UNIQUE NULLS NOT DISTINCT (country_code, code)
);
CREATE INDEX ON institution_types (parent_id);
CREATE INDEX ON institution_types (country_code);
-- Seed (global NULL): Business, Hospital, Clinic, Health Centre, School, University, Ministry, NGO Office.  MV: Council.
```

#### Provisioning templates (what `template_key` points at)
A **provisioning template** is the blueprint of defaults instantiated **when a tenant is created**, so a
new tenant is usable on day one rather than empty. Applied by the **provisioning engine** (component 04).

A template seeds, shaped for the institution:
- **Org structure** — default org units (a hospital → departments/wards; a council → sections).
- **Vocabulary/terminology** — what things are called (a health facility's stock points are "nurse
  stations"; a council's are "service counters").
- **Default roles**, **site types**, **item categories**, **numbering series**, and any starter config.

Mechanics:
- `template_key` is a **string**, resolved by the provisioning engine to a **code/seed-defined** blueprint
  (not a DB table — a template is structured behavior, not a flat row, and is not tenant-authored).
- **Shared across types:** many institution types can map to one template (`health_facility`,
  `government_office`, `council`, `business`/default). `NULL` → the generic default.
- **Future:** if admin-authored templates are ever needed, this becomes a `provisioning_templates` table
  (+ contents) — deferred until there's a real need.

---

## Identity (platform control-plane — NOT under tenant RLS)

Global: one identity spans all tenants; `users.id` = the Kratos subject. Verified-identity data (eFaas,
future national eIDs) hangs off `users` in separate 1:1 tables so the core stays lean.

### `users` — ✅ approved 2026-08-13
Lean projection of the Kratos identity (JIT-upserted on `whoami`). **No credentials** (Kratos owns them).

```sql
CREATE TABLE users (
  id            uuid        PRIMARY KEY,               -- = Kratos identity id (IdP subject); no DEFAULT — supplied by Kratos
  email         text        NOT NULL UNIQUE,           -- mirror of Kratos email trait; one global identity per email
  name          text        NOT NULL,                  -- profile/display name
  name_dv       text,                                  -- Dhivehi name — nullable
  phone         text,
  status        text        NOT NULL DEFAULT 'active', -- 'active' | 'disabled' (disable revokes sessions, UC-AUTH-11)
  last_login_at timestamptz,                           -- set on login/whoami; NULL until first login
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_users_status CHECK (status IN ('active','disabled'))
);
```

### `user_efaas_identities` — eFaas verified identity — ✅ approved 2026-08-13
1:1 with `users` (a row ⇔ eFaas-verified). Global (no `tenant_id`). **Most PII-sensitive table in the
foundation** — read access tightly gated (the user + explicitly authorized admins) + audited (05/06).

```sql
CREATE TABLE user_efaas_identities (
  user_id           uuid        PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,  -- 1:1 (PK = user_id)
  efaas_sub         text        NOT NULL UNIQUE,          -- eFaas OIDC 'sub' — matches a returning eFaas login
  id_number         text        NOT NULL UNIQUE,          -- national ID / A-number — one login per national identity
  name_en           text,                                 -- verified legal English name (may differ from users.name)
  name_dv           text,                                 -- verified legal Dhivehi name
  dob               date,                                 -- date of birth (calendar fact → date)
  gender            text,
  permanent_address jsonb,                                -- structured address components from eFaas
  present_address   jsonb,
  photo_ref         text,                                 -- pointer to photo in object storage, NOT the bytes
  mobile            text,
  email             text,                                 -- eFaas-verified email (may differ from users.email)
  claims            jsonb       NOT NULL DEFAULT '{}',    -- raw eFaas claim set (future-proof)
  verified_at       timestamptz NOT NULL DEFAULT now(),
  last_synced_at    timestamptz NOT NULL DEFAULT now(),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON user_efaas_identities (id_number);        -- link a person to HR/party records by national ID
```

### `tenants` — ✅ approved 2026-08-13
Platform control-plane (cross-tenant; **not** under tenant RLS). **Organisation-only** — `party_type_id`
must be organisation-class (**app-enforced + documented**; individuals are `users`/`parties`, never
tenants). Sole proprietors are supported (they're organisation-class). Billing profile + `seats` deferred to 08.

```sql
CREATE TABLE tenants (
  id                  uuid        PRIMARY KEY DEFAULT uuidv7(),
  slug                text        NOT NULL UNIQUE,             -- subdomain; immutable after go-live
  code                text        NOT NULL UNIQUE,             -- short official ref ('MCC','MOH'); used in document numbering + reports
  name                text        NOT NULL,                    -- official org name (English)
  name_dv             text,                                    -- official Dhivehi name — nullable (foreign tenants)
  party_type_id       uuid        REFERENCES party_types(id),        -- LEGAL form (identity docs). MUST be organisation-class (app-enforced). NULL until classified
  institution_type_id uuid        REFERENCES institution_types(id),  -- FUNCTION/sector (provisioning template). NULL until classified
  identity_type       text,                                    -- org identity doc type; validated vs party_type.allowed_identity_types
  identity_number     text,                                    -- org identity number (company reg no, …)
  email               text,                                    -- tenant contact email
  phone               text,                                    -- tenant contact phone (international form)
  is_internal         boolean     NOT NULL DEFAULT false,      -- the ONE internal/operator tenant; platform:* caps act platform-wide only via its roles
  parent_id           uuid        REFERENCES tenants(id),      -- hierarchy parent; NULL for roots
  oversight           text,                                    -- 'subordinate' (auto aggregate) | 'affiliated' (mutual agreement). NULL iff parent_id NULL
  tree_key            bigint      NOT NULL UNIQUE,             -- immutable ltree label
  path                ltree       NOT NULL,                    -- materialised hierarchy path of tree_keys; GiST-indexed
  connection_key      text        NOT NULL DEFAULT 'primary',  -- tenant → database routing; 'primary' for all in Phase 1 (stub)
  country             char(2)     NOT NULL REFERENCES countries(code),
  default_locale      text        NOT NULL DEFAULT 'en',       -- 'en' | 'dv'
  timezone            text        NOT NULL DEFAULT 'Indian/Maldives',
  status              text        NOT NULL DEFAULT 'provisioning', -- 'provisioning'|'active'|'suspended'|'archived'
  settings            jsonb       NOT NULL DEFAULT '{}',
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz,
  CONSTRAINT chk_tenants_oversight_pair CHECK ((parent_id IS NULL) = (oversight IS NULL)),
  CONSTRAINT chk_tenants_oversight_val  CHECK (oversight IS NULL OR oversight IN ('subordinate','affiliated')),
  CONSTRAINT chk_tenants_status         CHECK (status IN ('provisioning','active','suspended','archived')),
  CONSTRAINT chk_tenants_locale         CHECK (default_locale IN ('en','dv'))
);
CREATE UNIQUE INDEX uq_tenants_one_internal ON tenants ((is_internal)) WHERE is_internal;  -- at most ONE internal tenant
CREATE INDEX ON tenants USING GIST (path);
CREATE INDEX ON tenants (parent_id);
CREATE INDEX ON tenants (status);
```
> **Invariant (app-enforced):** `party_type_id` references an organisation-class `party_type`. Provisioning
> rejects individual-class types; individuals are represented as `users`/`parties`, never tenants.

### `tenant_users` — membership — ✅ approved 2026-08-13
Platform control-plane (cross-tenant; **not** under tenant RLS — the tenant switcher + membership
resolution read across tenants). Lifecycle link → `active_from`/`active_to` (not `deleted_at`).

```sql
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
```

---

## 01 foundation data model — COMPLETE ✅ (10 tables, confirmed 2026-08-13)

Reference: `currencies`, `countries`, `geography_levels`, `geographies` · Classification: `party_types`,
`institution_types` · Identity/tenancy: `users`, `user_efaas_identities`, `tenants`, `tenant_users`.

**Deferred to their owning components (each defines its full DDL when first introduced):**
`module_activations`, `audit_log`, `event_outbox` (06/foundation) ·
billing profile + `seats` on `tenants`, `pricelist_id` on `countries`, billing tables (08) · `parties`, sites,
org_units, and all business/module tables (later components).

---

## Authorization (05) — control-plane (cross-tenant by nature — role administration reads across
tenant switches), **not** under the tenant RLS regime, same as `tenants`/`tenant_users`.

### `roles` — ✅ approved 2026-09-02
Per-tenant. The internal/operator tenant's roles are just roles where `tenant_id` = the one
`is_internal` tenant; `platform:*` capabilities only act platform-wide when held via such a role
(Cerbos's `is_internal_member` principal attribute is authoritative, not this table alone).

```sql
CREATE TABLE roles (
  id          uuid        PRIMARY KEY DEFAULT uuidv7(),
  tenant_id   uuid        NOT NULL REFERENCES tenants(id),
  code        text        NOT NULL,          -- stable key within the tenant ('owner','admin','member', or custom)
  name        text        NOT NULL,
  name_dv     text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz,
  CONSTRAINT uq_roles_tenant_code UNIQUE (tenant_id, code),
  CONSTRAINT uq_roles_tenant_id   UNIQUE (tenant_id, id)   -- FK target for user_roles' composite guard
);
CREATE INDEX ON roles (tenant_id);
```

### `role_capabilities` — ✅ approved 2026-09-02
The capability catalog itself is **code-seeded** (FR-AUTHZ-02), not a table — `capability` is a
validated string key, not an FK. Nothing at the DB level stops a `platform:*` row on a non-internal
tenant's role; that's a deliberate call to rely on Cerbos's `is_internal_member` check alone rather
than duplicate the guard here.

```sql
CREATE TABLE role_capabilities (
  id          uuid        PRIMARY KEY DEFAULT uuidv7(),
  role_id     uuid        NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  capability  text        NOT NULL,          -- catalog key, e.g. 'members:invite'
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_role_capabilities UNIQUE (role_id, capability)
);
CREATE INDEX ON role_capabilities (role_id);
```

### `user_roles` — ✅ approved 2026-09-02
Assigns a role to a `tenant_users` **membership** (not directly to a user — a role only means
something within that membership's tenant). `tenant_id` is denormalised solely to carry the composite
FKs below, which close a real gap: without them, a bug in principal-building (joining `user_roles` →
`roles` without also checking `roles.tenant_id`) could let a member inherit another tenant's role.
Requires `tenant_users` to also carry `UNIQUE (tenant_id, id)` as an FK target.

```sql
ALTER TABLE tenant_users ADD CONSTRAINT uq_tenant_users_tenant_id UNIQUE (tenant_id, id);

CREATE TABLE user_roles (
  id              uuid        PRIMARY KEY DEFAULT uuidv7(),
  tenant_id       uuid        NOT NULL,
  tenant_user_id  uuid        NOT NULL,
  role_id         uuid        NOT NULL,
  assigned_by     uuid        REFERENCES users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_user_roles_tenant_user FOREIGN KEY (tenant_id, tenant_user_id) REFERENCES tenant_users (tenant_id, id),
  CONSTRAINT fk_user_roles_role        FOREIGN KEY (tenant_id, role_id)        REFERENCES roles (tenant_id, id),
  CONSTRAINT uq_user_roles UNIQUE (tenant_user_id, role_id)
);
CREATE INDEX ON user_roles (tenant_user_id);
CREATE INDEX ON user_roles (role_id);
```

### `access_grants` — ✅ approved 2026-09-02
Support access / impersonation only (UC-AUTHZ-07 → UC-AUTH-14). Time-boxed, four-eyes gated
(`approved_by` must differ from `proposed_by`). Deliberately **not** shared with internal-tenant role
changes (see `role_change_proposals` below) — the two are different-shaped records that only happen
to share a four-eyes workflow; combining them would force `tenant_id`/`target_user_id`/`expires_at`
to all be conditionally-nullable.

```sql
CREATE TABLE access_grants (
  id             uuid        PRIMARY KEY DEFAULT uuidv7(),
  tenant_id      uuid        NOT NULL REFERENCES tenants(id),
  target_user_id uuid        NOT NULL REFERENCES users(id),
  reason         text        NOT NULL,
  status         text        NOT NULL DEFAULT 'proposed',
  proposed_by    uuid        NOT NULL REFERENCES users(id),
  approved_by    uuid        REFERENCES users(id),
  approved_at    timestamptz,
  expires_at     timestamptz,
  revoked_at     timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_access_grants_status   CHECK (status IN ('proposed','pending_approval','approved','rejected','revoked','expired')),
  CONSTRAINT chk_access_grants_approver CHECK (approved_by IS NULL OR approved_by <> proposed_by)
);
CREATE INDEX ON access_grants (status);
CREATE INDEX ON access_grants (tenant_id);
CREATE INDEX ON access_grants (target_user_id);
```

### `role_change_proposals` — ✅ approved 2026-09-02
Internal-tenant role/capability/assignment four-eyes (UC-AUTHZ-06). No `tenant_id` — always
implicitly the one internal tenant, nothing to scope.

```sql
CREATE TABLE role_change_proposals (
  id           uuid        PRIMARY KEY DEFAULT uuidv7(),
  payload      jsonb       NOT NULL,          -- the proposed role/capability/assignment diff
  reason       text        NOT NULL,
  status       text        NOT NULL DEFAULT 'proposed',
  proposed_by  uuid        NOT NULL REFERENCES users(id),
  approved_by  uuid        REFERENCES users(id),
  approved_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_role_change_status   CHECK (status IN ('proposed','pending_approval','approved','rejected')),
  CONSTRAINT chk_role_change_approver CHECK (approved_by IS NULL OR approved_by <> proposed_by)
);
```
