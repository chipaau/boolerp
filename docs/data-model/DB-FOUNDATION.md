# DB — Foundation (Phase 1)

Confirmed foundation tables. **Pooled + RLS**, grain `tenant_id`. Global reference tables carry **no**
`tenant_id`; business tables carry `tenant_id` + the RLS visible-set policy. Conventions: UUID v7 PKs on
business tables, `timestamptz` times, bilingual `name`/`name_dv`, ltree + `tree_key` hierarchies. See
`.claude/rules/tenancy.md` + `conventions.md`.

> Built **table-by-table**, each explicitly approved by the user. No table is added without that.

---

## Reference data (global — no `tenant_id`, not RLS-scoped)

### `currencies` — ✅ approved 2026-08-13, revised 2026-09-12 (docs/code audit)
Seeded (MVR, USD). Money columns across the system FK `currencies.code`.

```sql
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
```

> **2026-09-12:** surfaced by a docs/code audit — this table exists in code
> (`00003_reference.sql`) but had never been through this session's review. Dropped `name_dv`
> (reference/taxonomy label — a document prints the `symbol`/`code`, not the currency's name
> spelled out in Dhivehi; same reasoning as `institution_types`/`party_types`/`geography_levels`).
> Replaced `is_active` with `active_from`/`active_to` for consistency with the other reference
> tables revised this session.

### `countries` — ✅ approved 2026-08-13, revised 2026-09-11 (docs consolidation review)
~196 real ISO 3166-1 countries seeded. `tenants.country` FKs this. **No `pricelist_id` here** — that
billing column + FK is added in component 08 (billing), not 01.

```sql
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
```

> **2026-09-11 revision:** dropped `name_dv` (`NOT NULL` on all ~196 rows, most with no evidenced
> Dhivehi need) in favour of `name_i18n` (sparse, same pattern as `tenants`). Dropped
> `default_locale` — its own comment said "Default UI language for tenants here," which contradicts
> the confirmed "no app-level multi-language/RTL" scope; nothing left for it to drive. Replaced
> `is_active` with `active_from`/`active_to`, matching `party_types`.

### `geography_levels` — ✅ approved 2026-08-13, revised 2026-09-11 (docs consolidation review)
Per-country level taxonomy. `country_code` **NULL = global default** (fallback for any country without
its own set). Resolution (app logic): a country's own rows if any exist, else the global rows — no mixing.

```sql
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
-- Seed: global (NULL) → region/district/city; MV → atoll/island/ward.
```

> **2026-09-11 revision:** dropped `name_dv` — this is a form-field caption ("drives address-form
> field names"), not a printed value; no confirmed document prints a level label, and there's no
> app-level UI to translate it for. Replaced `is_active` with `active_from`/`active_to`, matching
> `countries`/`party_types`.

### `geographies` — ✅ approved 2026-08-13, revised 2026-09-11 (docs consolidation review)
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
```

> **2026-09-11 revision:** converted `name_dv` to `name_i18n` — a place is an entity's own name
> (like `tenants`/`countries`), not a taxonomy label, so it gets the same treatment for consistency
> even though today's MV-only scoping means only `dv` is populated in practice. Replaced `is_active`
> with `active_from`/`active_to`, matching the other reference tables revised this session.

---

## Classification (global — no `tenant_id`)

Two **orthogonal** dimensions: `party_types` = **legal form** (drives identity docs); `institution_types`
= **function/sector** (drives provisioning template). A tenant carries both. Example: a private hospital =
`party_type` Private Company + `institution_type` Hospital.

### `party_types` — legal form — ✅ approved 2026-08-13, revised 2026-09-11 (docs consolidation review)
Country-scoped, **additive** resolution (a country's effective set = global `NULL` rows ∪ its own rows).

```sql
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
-- Seed (global NULL, flat): individual → Local, Foreign, Work Permit; organisation → Government, NGO, Sole Proprietor, Public Company, Private Company, Partnership.
```

> **2026-09-11 revision:** dropped `parent_id` (no confirmed rule ever walks the tree — the
> organisation-class invariant, `allowed_identity_types`, and the oversight gov→gov default all
> operate on the flat `party_type_class`/`code` fields directly; the `Individual`/`Organisation`/
> `Company` grouping rows were structural-only, never themselves a selectable type) and `name_dv`
> (same reasoning as `institution_types` — no evidenced need to translate a taxonomy label).
> Replaced `is_active` with `active_from`/`active_to` — **open question, not yet a general
> convention:** the other reference tables (`currencies`, `countries`, `geography_levels`,
> `institution_types`) still use `is_active`; revisit whether this should apply uniformly.

### `institution_types` — function / sector — ✅ approved 2026-08-13, revised 2026-09-11 (docs consolidation review)
The *what an entity does* dimension; selects the provisioning template. Country-scoped, additive
(global `NULL` ∪ country rows). `tenants.institution_type_id` will reference it.

```sql
CREATE TABLE institution_types (
  id            uuid        PRIMARY KEY DEFAULT uuidv7(),
  country_code  char(2)     REFERENCES countries(code),        -- NULL = global default; set = country-specific (MV 'council')
  code          text        NOT NULL,                          -- stable key ('ministry','council','hospital','health-centre','school','business')
  name          text        NOT NULL,                          -- English label

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
CREATE INDEX ON institution_types (country_code);
-- Seed: pending — see the expanded proposal drafted from the Maldives government-structure documents.
```

> **2026-09-11 revision:** dropped `name_dv` (no evidenced need — the government registry documents
> show bilingual *institution names*, i.e. `tenants.name_i18n` territory, not translated *type*
> labels) and `parent_id` (no concrete grouping decided yet; the flat 8-item seed never used it).
> Re-add either if the expanded seed list (next) turns out to need them for real.

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

### `users` — ✅ approved 2026-08-13, revised 2026-09-11 (docs consolidation review)
Lean projection of the Kratos identity (JIT-upserted on `whoami`). **No credentials** (Kratos owns them).

```sql
CREATE TABLE users (
  id            uuid        PRIMARY KEY,               -- = Kratos identity id (IdP subject); no DEFAULT — supplied by Kratos
  email         text        NOT NULL UNIQUE,           -- mirror of Kratos email trait; one global identity per email
  name          text        NOT NULL,                  -- canonical/operational name (English)
  name_i18n     jsonb       NOT NULL DEFAULT '{}',     -- local-script name for DOCUMENT GENERATION only, e.g. {"dv": "..."} — sparse, populate as needed
  phone         text,
  status        text        NOT NULL DEFAULT 'active', -- 'active' | 'disabled' (disable revokes sessions, UC-AUTH-11)
  last_login_at timestamptz,                           -- set on login/whoami; NULL until first login
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_users_status CHECK (status IN ('active','disabled'))
);
```

> **2026-09-11 revision:** converted `name_dv` to `name_i18n` — a person's own name, same bucket as
> `tenants`/`countries`/`geographies`, for the same document-generation reasoning. `status` stays as
> a simple flag rather than `active_from`/`active_to`: a user can cycle disabled→re-enabled multiple
> times, which a single window can't represent, and *when* it changed belongs to `audit_log`
> (component 06), not a column here.

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

### `tenants` — ✅ approved 2026-08-13, revised 2026-09-11 (docs consolidation review)
Platform control-plane (cross-tenant; **not** under tenant RLS). **Organisation-only** — `party_type_id`
must be organisation-class (**app-enforced + documented**; individuals are `users`/`parties`, never
tenants). Sole proprietors are supported (they're organisation-class). Billing profile + `seats` deferred to 08.

```sql
CREATE TABLE tenants (
  id                  uuid        PRIMARY KEY DEFAULT uuidv7(),
  slug                text        NOT NULL UNIQUE,             -- subdomain; immutable after go-live
  code                text        NOT NULL UNIQUE,             -- short official ref ('MCC','MOH'); used in document numbering + reports
  name                text        NOT NULL,                    -- canonical/operational name (English) — universal fallback, used throughout the app
  name_i18n           jsonb       NOT NULL DEFAULT '{}',       -- jurisdiction-required local-script legal name for DOCUMENT GENERATION only (e.g. {"dv": "..."} for MV) — which key a document uses is decided by the document template (Phase 2), not a tenant default; absent key falls back to `name`
  party_type_id       uuid        REFERENCES party_types(id),        -- LEGAL form (identity docs + oversight default). MUST be organisation-class (app-enforced). NULL until classified
  institution_type_id uuid        REFERENCES institution_types(id),  -- FUNCTION/sector (provisioning template). NULL until classified
  identity_type       text,                                    -- org identity doc type; validated vs party_type.allowed_identity_types ([] = none, e.g. Government)
  identity_number     text,                                    -- org identity number (company reg no, …); NULL where the type has none
  email               text,                                    -- tenant contact email
  phone               text,                                    -- tenant contact phone (international form)
  is_internal         boolean     NOT NULL DEFAULT false,      -- the ONE internal/operator tenant; resolves admin.bool.test's membership check; Cerbos is_internal_member reads this
  parent_id           uuid        REFERENCES tenants(id),      -- hierarchy parent; NULL for roots
  oversight           text,                                    -- 'subordinate' (auto aggregate) | 'affiliated' (mutual agreement). NULL iff parent_id NULL
  tree_key            bigint      NOT NULL UNIQUE,             -- immutable ltree label
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
  CONSTRAINT chk_tenants_active_order   CHECK (active_to IS NULL OR active_from IS NULL OR active_to >= active_from)
);
CREATE UNIQUE INDEX uq_tenants_one_internal ON tenants ((is_internal)) WHERE is_internal;  -- at most ONE internal tenant
CREATE INDEX ON tenants USING GIST (path);
CREATE INDEX ON tenants (parent_id);
CREATE INDEX ON tenants (status);
```
> **Invariant (app-enforced):** `party_type_id` references an organisation-class `party_type`. Provisioning
> rejects individual-class types; individuals are represented as `users`/`parties`, never tenants.

> **Each tenant is one legal entity/company** (ADR 0001, Decision 2 — no separate `company_id` grain).
> `oversight` (`subordinate`/`affiliated`) is an **administrative/authority relationship**, not equity
> ownership — there is deliberately no ownership-percentage column here. `parent_id`/`oversight`
> support **read-side rollup** (`tenant_visibility_grants` + aggregate reporting), which is safe as
> plain addition only because inter-tenant flows are notional (no invoice, nothing booked as
> revenue) — see ADR 0001's "Deferred: real financial consolidation" for the named trigger where
> that stops being sufficient (real intercompany trading needing elimination) and why the fix is an
> additive layer later, not a column added here now.

> **2026-09-11 revision, column-by-column reconfirmation** (per the strengthened data-model rule in
> `.claude/rules/conventions.md`): dropped `name_dv` (replaced by `name_i18n` — see below), `deleted_at`
> (replaced by `active_from`/`active_to`, matching `tenant_users`), `connection_key` (unused stub; ADR
> 0001 still names the mechanic, re-add when a routing feature actually consumes it), and `settings`
> (no documented shape, no consumer — re-add with a real, named use). Kept `party_type_id` (Government
> tenants have no registration number; the oversight default is derived from party type) and `is_internal`
> (the anchor `admin.bool.test`'s membership check and Cerbos's `is_internal_member` resolve against —
> not replaceable by domain separation alone, since Kratos sessions are shared across every `*.bool.test`
> subdomain). Considered and rejected a `document_locale`/`default_locale` column: which language a
> document renders in is a property of the **document template** (Phase 2's deferred "Documents &
> numbering" topic), not a single tenant-wide default — Maldives itself requires English for some
> documents and Dhivehi for others *within the same tenant*. `oversight` stays `text` + CHECK rather
> than a native enum, for consistency with every other small-fixed-set column in this schema.
>
> **`name_i18n` resolution (no schema needed beyond the column):** a document needing language `X` reads
> `name_i18n->>'X'`; if absent, falls back to canonical `name`. "Available languages" for a tenant's name
> is just whatever keys happen to exist in `name_i18n`, plus English (always available via `name`) — not
> a separate tracked list.

### `tenant_users` — membership — ✅ approved 2026-08-13, revised 2026-09-12
Platform control-plane (cross-tenant; **not** under tenant RLS — the tenant switcher + membership
resolution read across tenants). Lifecycle link → `active_from`/`active_to` (not `deleted_at`).

> **2026-09-12:** `invited_by` reconsidered and kept — membership creation and role granting are
> separate events, and deriving "who invited this person" from a role grant's `assigned_by` isn't a
> reliable equivalent. `is_owner` also stays — see prior discussion: ownership is a platform-level
> fact with no natural `app_id`, so it can't be represented as a role the way everything else now is.

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
`audit_log`, `event_outbox` (06/foundation) ·
billing profile + `seats` on `tenants`, `pricelist_id` on `countries`, billing tables (08) · `parties`, sites,
org_units, and all business/module tables (later components).

> `module_activations` was pulled forward and approved 2026-09-12 as `apps`/`tenant_apps` (see
> Authorization below) — needed once `roles` became app-scoped, ahead of its originally-planned slot.

---

## Authorization (05) — control-plane (cross-tenant by nature — role administration reads across
tenant switches), **not** under the tenant RLS regime, same as `tenants`/`tenant_users`.

### `apps` — ✅ approved 2026-09-12
The ERP workspace's app catalog (Control Centre, Inventory, HRMS, Procurement, Performance, …).
Pulls forward the `module_activations` concept `tenant_apps` below was already reserving a slot for
(see the 01 foundation deferred list) — needed now because `roles` is app-scoped.

```sql
CREATE TABLE apps (
  id            uuid        PRIMARY KEY DEFAULT uuidv7(),
  code          text        NOT NULL UNIQUE,   -- stable key ('inventory','hrms','procurement','performance','control-centre')
  name          text        NOT NULL,
  requires_role boolean     NOT NULL DEFAULT true,  -- false = self-service app usable with no role (own-record actions only); true = must resolve to a default or assigned role
  active_from   timestamptz NOT NULL DEFAULT now(),
  active_to     timestamptz,                    -- retired; NULL = still active
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_apps_active_order CHECK (active_to IS NULL OR active_to >= active_from)
);
```

### `tenant_apps` — ✅ approved 2026-09-12, revised 2026-09-12 (config moved to `tenant_settings`)
Which apps a tenant has activated. Not under tenant RLS (control-plane, same as `tenants`/`tenant_users`).

```sql
CREATE TABLE tenant_apps (
  id           uuid        PRIMARY KEY DEFAULT uuidv7(),
  tenant_id    uuid        NOT NULL REFERENCES tenants(id),
  app_id       uuid        NOT NULL REFERENCES apps(id),
  activated_by uuid        REFERENCES users(id),          -- NULL if activated by the provisioning engine
  active_from  timestamptz NOT NULL DEFAULT now(),
  active_to    timestamptz,                                -- deactivated; NULL = currently on
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_tenant_apps_active_order CHECK (active_to IS NULL OR active_to >= active_from)
);
CREATE UNIQUE INDEX uq_tenant_apps_current ON tenant_apps (tenant_id, app_id) WHERE active_to IS NULL;  -- one CURRENT activation per (tenant, app)
CREATE INDEX ON tenant_apps (tenant_id);
CREATE INDEX ON tenant_apps (app_id);
```

> `requires_role_approval` moved to `tenant_settings` (below) — **tenant-wide**, not app-scoped
> (applies uniformly across all of a tenant's apps, same as `requires_support_access_approval`).

### `tenant_settings` — ✅ approved 2026-09-12
Tenant-wide configuration toggles (`requires_role_approval`, `requires_support_access_approval`).
`key` is code-seeded (a validated string, not an FK) — same treatment as
`role_capabilities.capability`; there is deliberately no settings-catalog table until a real need
for admin-authored keys appears.

> `app_id` is `NULL` for both settings confirmed so far (both are tenant-wide) — kept nullable
> because app-scoped settings are expected soon, not speculative.

```sql
CREATE TABLE tenant_settings (
  id          uuid        PRIMARY KEY DEFAULT uuidv7(),
  tenant_id   uuid        NOT NULL REFERENCES tenants(id),
  app_id      uuid        REFERENCES apps(id),   -- NULL = tenant-wide; set = this app's setting for this tenant
  key         text        NOT NULL,               -- 'requires_role_approval', 'requires_support_access_approval', …
  value       jsonb       NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_tenant_settings_scope UNIQUE NULLS NOT DISTINCT (tenant_id, app_id, key)
);
CREATE INDEX ON tenant_settings (tenant_id);
CREATE INDEX ON tenant_settings (app_id);
```

### `user_apps` — ✅ approved 2026-09-12
Which apps a specific user is subscribed to, within a tenant — **separate from holding a role**.
Resolves an open question from this review: app access is not derived from `user_roles` (a user can
be subscribed to an app pending role assignment); it's tracked explicitly, matching a pattern
confirmed present in the sibling `sentinel-api` comparison.

```sql
CREATE TABLE user_apps (
  id          uuid        PRIMARY KEY DEFAULT uuidv7(),
  tenant_id   uuid        NOT NULL REFERENCES tenants(id),
  user_id     uuid        NOT NULL REFERENCES users(id),
  app_id      uuid        NOT NULL REFERENCES apps(id),
  active_from timestamptz NOT NULL DEFAULT now(),
  active_to   timestamptz,                           -- unsubscribed; NULL = currently subscribed
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_user_apps_active_order CHECK (active_to IS NULL OR active_to >= active_from)
);
CREATE UNIQUE INDEX uq_user_apps_current ON user_apps (tenant_id, user_id, app_id) WHERE active_to IS NULL;  -- one CURRENT subscription per (tenant, user, app)
CREATE INDEX ON user_apps (tenant_id);
CREATE INDEX ON user_apps (user_id);
CREATE INDEX ON user_apps (app_id);
```

### `roles` — ✅ approved 2026-09-02, revised 2026-09-12 (app-scoped)
App-scoped, not tenant-scoped: `tenant_id` **NULL = a global role template for that app** (shared by
every tenant with the app activated), **set = that tenant's own custom role** for the app, assignable
only to that tenant's users (app-enforced — see `user_roles`). The internal/operator tenant's roles
are just custom roles where `tenant_id` = the one `is_internal` tenant; `platform:*` capabilities only
act platform-wide when held via such a role (Cerbos's `is_internal_member` principal attribute is
authoritative, not this table alone). `app_id` is `ON DELETE RESTRICT` — an app can't be deleted while
roles still reference it, so a role can never dangle.

```sql
CREATE TABLE roles (
  id          uuid        PRIMARY KEY DEFAULT uuidv7(),
  app_id      uuid        NOT NULL REFERENCES apps(id) ON DELETE RESTRICT,
  tenant_id   uuid        REFERENCES tenants(id),   -- NULL = global template; set = this tenant's own custom role
  code        text        NOT NULL,                 -- stable key ('owner','admin','member', or a tenant's custom key)
  name        text        NOT NULL,
  is_default  boolean     NOT NULL DEFAULT false,   -- the baseline role a user gets on subscribing to this app (global templates only, see index below)
  active_from timestamptz NOT NULL DEFAULT now(),
  active_to   timestamptz,                           -- retired; NULL = still active
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_roles_app_tenant_code UNIQUE NULLS NOT DISTINCT (app_id, tenant_id, code),
  CONSTRAINT chk_roles_active_order CHECK (active_to IS NULL OR active_to >= active_from)
);
CREATE INDEX ON roles (app_id);
CREATE INDEX ON roles (tenant_id);
CREATE UNIQUE INDEX uq_roles_one_default_per_app ON roles (app_id) WHERE is_default AND tenant_id IS NULL;  -- at most one global default per app; a tenant's own custom roles are never "the" default
```

### `role_capabilities` — ✅ approved 2026-09-02, reconfirmed 2026-09-12
The capability catalog itself is **code-seeded** (FR-AUTHZ-02), not a table — `capability` is a
validated string key, not an FK. Nothing at the DB level stops a `platform:*` row on a non-internal
tenant's role; that's a deliberate call to rely on Cerbos's `is_internal_member` check alone rather
than duplicate the guard here.

> **2026-09-12:** considered promoting `capability` to a real reference table (`sentinel-api` has
> exactly this — `id`/`name`/`description`/`app_id`, letting a UI show a human description instead
> of a raw `module:resource:action` key). Kept as a code-seeded string for now — no Control Centre
> role-editing UI exists yet to consume a `description` field. Revisit when that UI is built.

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

### `user_roles` — ✅ approved 2026-09-02, revised 2026-09-12 (app-scoped roles; time-bounded)
**RLS-scoped** (00010_authorization_rls.sql) — unlike `roles` itself, every row here belongs to
exactly one real tenant (no global-template case), so it fits the standard visible-set policy.
Assigns a user a role, within a tenant. Both integrity checks the old composite FKs used to provide
are now **app-enforced** (documented, not DB-guaranteed) — necessary once `roles.tenant_id` became
nullable, since a composite FK can't match a real tenant id against a global role's `NULL`:
1. `user_id` must be an active member of `tenant_id` (`tenant_users` row, `active_to IS NULL`, `status = 'active'`).
2. `role_id`'s role must be visible to `tenant_id` — global (`roles.tenant_id IS NULL`) or owned by this exact tenant.

`active_from`/`active_to` make a grant **time-bounded** — covers acting appointments (a temporary
role for the duration of someone's leave, scheduled in advance) as well as standing assignments
(`active_to IS NULL`). Revoking early means **setting `active_to`**, not deleting the row — the
history of who held a role and when is worth keeping. An authorization check for "does this user
currently hold this role" now means `active_from <= now() AND (active_to IS NULL OR active_to > now())`,
not just row-exists.

```sql
CREATE TABLE user_roles (
  id           uuid        PRIMARY KEY DEFAULT uuidv7(),
  tenant_id    uuid        NOT NULL REFERENCES tenants(id),
  user_id      uuid        NOT NULL REFERENCES users(id),
  role_id      uuid        NOT NULL REFERENCES roles(id),   -- app-enforced, see invariant 2 above
  assigned_by  uuid        REFERENCES users(id),            -- audit: who made the assignment; NULL if system-assigned
  active_from  timestamptz NOT NULL DEFAULT now(),          -- when the grant takes effect — can be scheduled ahead (e.g. an acting appointment's start)
  active_to    timestamptz,                                 -- when it ends; NULL = standing/indefinite
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_user_roles_active_order CHECK (active_to IS NULL OR active_to >= active_from)
);
CREATE UNIQUE INDEX uq_user_roles_current ON user_roles (tenant_id, user_id, role_id) WHERE active_to IS NULL;  -- one CURRENT/standing grant per (tenant, user, role); a past, ended grant doesn't block re-granting later
CREATE INDEX ON user_roles (user_id);
CREATE INDEX ON user_roles (role_id);
CREATE INDEX ON user_roles (tenant_id);
```

### `role_requests` — ✅ approved 2026-09-12
**RLS-scoped** (00010_authorization_rls.sql) — `tenant_id` is `NOT NULL` on every row, same reasoning
as `user_roles` above.
The 4-eyes path into `user_roles`, opt-in per the tenant-wide `tenant_settings` key
`requires_role_approval`. When that setting is `false` (or unset) for a tenant, an admin inserts
into `user_roles` directly (unchanged). When `true`, a grant must pass through here first —
`status = 'approved'` is what application code checks before creating the matching `user_roles`
row. Adapted from a comparable pattern in a sibling project (`sentinel-api`'s
`access_requests`, evolved there from an earlier single-stage `role_requests` into this two-stage
shape) — credited here since the design (particularly the reviewer≠approver distinctness and the
request-level `review_deadline_at` vs. grant-level `expires_at` split) isn't original to this repo.

```sql
CREATE TABLE role_requests (
  id                 uuid        PRIMARY KEY DEFAULT uuidv7(),
  tenant_id          uuid        NOT NULL REFERENCES tenants(id),
  target_user_id     uuid        NOT NULL REFERENCES users(id),   -- who the role is for (self-request allowed)
  role_id            uuid        NOT NULL REFERENCES roles(id),   -- app is implied via roles.app_id
  requested_by       uuid        NOT NULL REFERENCES users(id),
  reason             text        NOT NULL,
  status             text        NOT NULL DEFAULT 'pending_review',
  reviewed_by        uuid        REFERENCES users(id),
  reviewed_at        timestamptz,
  approved_by        uuid        REFERENCES users(id),
  approved_at        timestamptz,
  review_deadline_at timestamptz,                                  -- unactioned request auto-expires; NULL = no deadline
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_role_requests_status     CHECK (status IN ('pending_review','pending_approval','approved','rejected','expired')),
  CONSTRAINT chk_requester_not_reviewer   CHECK (reviewed_by IS NULL OR requested_by <> reviewed_by),
  CONSTRAINT chk_requester_not_approver   CHECK (approved_by IS NULL OR requested_by <> approved_by),
  CONSTRAINT chk_reviewer_not_approver    CHECK (approved_by IS NULL OR reviewed_by IS NULL OR reviewed_by <> approved_by)
);
CREATE INDEX ON role_requests (tenant_id);
CREATE INDEX ON role_requests (target_user_id);
CREATE INDEX ON role_requests (status);
CREATE INDEX ON role_requests (review_deadline_at);
```

### `support_access_grants` — ✅ approved 2026-09-02, revised 2026-09-12 (renamed, two-stage, tenant-facing)
**RLS-scoped** (00010_authorization_rls.sql) — `tenant_id` is `NOT NULL` on every row, same reasoning
as `user_roles` above.
Support access / impersonation (UC-AUTHZ-07 → UC-AUTH-14) — an operator getting time-boxed,
audited access into a *different* tenant's data. Renamed from `access_grants` to match the term
already used in `auth.md`/the glossary ("support-access grant"). Deliberately **not** shared with
role assignment (`role_requests`) — different-shaped records that only happen to share a four-eyes
workflow; combining them would force `tenant_id`/`target_user_id`/`expires_at` to all be
conditionally-nullable.

`target_user_id` is always required — even a general data check (not impersonating anyone
specific) is framed as viewing-as a specific tenant user (typically the owner), never an
unattributed admin view; every access has a clear "viewing as" record in the audit trail.

Two-stage (`reviewed_by`/`reviewed_at` then a separately distinct `approved_by`/`approved_at`) —
upgraded from the original single-stage design to match `role_requests`, since this table guards
access into another company's data and shouldn't have *less* rigor than internal role grants.
`review_deadline_at` closes a gap the original design had (an unactioned proposal could sit
forever) — same pattern as `role_requests`.

The tenant is always notified (`tenant_notified_at`) once a grant is proposed. Whether the
*tenant's own* sign-off (`tenant_approved_by`/`tenant_approved_at`) is required before the grant
can proceed is opt-in per tenant — the `tenant_settings` key `requires_support_access_approval`
(tenant-wide, `app_id IS NULL`). `tenant_approved_by` being an actual member of `tenant_id` is
app-enforced, same treatment as the membership checks on `user_roles`.

```sql
CREATE TABLE support_access_grants (
  id                  uuid        PRIMARY KEY DEFAULT uuidv7(),
  tenant_id           uuid        NOT NULL REFERENCES tenants(id),
  target_user_id      uuid        NOT NULL REFERENCES users(id),
  reason              text        NOT NULL,
  status              text        NOT NULL DEFAULT 'pending_review',
  proposed_by         uuid        NOT NULL REFERENCES users(id),
  reviewed_by         uuid        REFERENCES users(id),
  reviewed_at         timestamptz,
  approved_by         uuid        REFERENCES users(id),
  approved_at         timestamptz,
  tenant_notified_at  timestamptz,
  tenant_approved_by  uuid        REFERENCES users(id),
  tenant_approved_at  timestamptz,
  review_deadline_at  timestamptz,
  expires_at          timestamptz,
  revoked_at          timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_support_access_grants_status CHECK (status IN ('pending_review','pending_approval','approved','rejected','revoked','expired')),
  CONSTRAINT chk_proposer_not_reviewer        CHECK (reviewed_by IS NULL OR proposed_by <> reviewed_by),
  CONSTRAINT chk_proposer_not_approver        CHECK (approved_by IS NULL OR proposed_by <> approved_by),
  CONSTRAINT chk_reviewer_not_approver        CHECK (approved_by IS NULL OR reviewed_by IS NULL OR reviewed_by <> approved_by)
);
CREATE INDEX ON support_access_grants (status);
CREATE INDEX ON support_access_grants (tenant_id);
CREATE INDEX ON support_access_grants (target_user_id);
```

> **`role_change_proposals` (previously approved 2026-09-02) was dropped 2026-09-12.** Its one
> confirmed use — four-eyes on assigning a role to a user in the internal tenant — is now covered by
> `role_requests` (set the internal tenant's `tenant_settings` key `requires_role_approval` to
> `true`). Its other nominal scope — creating/reshaping internal roles or capabilities at runtime — has
> no confirmed consumer: capabilities are code-seeded, not authored at runtime (see
> `role_capabilities` above), and no concrete case for dynamically-authored internal roles has come
> up. Re-add if one does.

## Audit (06) — ✅ approved 2026-09-12

### `audit_log` — ✅ approved 2026-09-12

Immutable, append-only business audit trail — distinct from technical tracing/logging (07).
**Tenant-scoped and RLS-protected**, unlike the platform/control-plane tables above: this is the
first table to actually need the `FORCE ROW LEVEL SECURITY` + isolation-policy enforcement
`00002_app_role.sql` promised would land "with the first tenant-scoped business table." Reads are
tenant-scoped (FR-AUD-06); a write can only happen inside a `tenancy.WithTenant`-resolved
transaction, since `tenant_id` resolves from the column default and the `WITH CHECK` clause requires
it to match the transaction's current tenant.

```sql
CREATE TABLE audit_log (
  id                uuid        PRIMARY KEY DEFAULT uuidv7(),
  tenant_id         uuid        NOT NULL REFERENCES tenants(id) DEFAULT current_setting('app.current_tenant')::uuid,
  actor_user_id     uuid        REFERENCES users(id),   -- who did it; NULL if system-initiated
  acting_as_user_id uuid        REFERENCES users(id),   -- FR-AUD-04: the subject being impersonated during a support session (actor_user_id stays the real operator). NULL in ordinary use — not wired yet, no impersonation feature exists.
  entity_type       text        NOT NULL,                -- e.g. 'tenant'; open vocabulary, app-validated (like role_capabilities.capability)
  entity_id         uuid        NOT NULL,
  action            text        NOT NULL,                -- e.g. 'create', 'suspend', 'reactivate', 'archive'
  payload           jsonb       NOT NULL,                -- changed-column diff for updates; full snapshot for create/delete (FR-AUD-03's "before/after")
  request_id        text,                                -- correlation id; wired through once 07 (observability) lands
  ip                inet,
  occurred_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON audit_log (tenant_id);
CREATE INDEX ON audit_log (entity_type, entity_id);
CREATE INDEX ON audit_log (actor_user_id);
CREATE INDEX ON audit_log (occurred_at);
```

Append-only (FR-AUD-01) is **DB-enforced**, not just "no application code path happens to update or
delete it": a `BEFORE UPDATE OR DELETE` trigger (`trg_audit_log_append_only`) raises an exception
unconditionally — the same pattern this session already used app-side for four-eyes CHECK
constraints, but a trigger is what it takes to reject mutation outright.

> **Known simplifications, not silently dropped:** (1) no real Postgres partitioning by
> `(tenant_id, month)` yet (FR-AUD-07) — a single table for now, disproportionate to build at
> current data volume; revisit before real production retention matters. (2) No `audit:view`
> read/search endpoint yet (FR-AUD-06) — this migration is capture-only, wired at the tenant-CRUD
> transaction boundary (create/suspend/reactivate/archive). (3) `acting_as_user_id` exists in the
> schema for FR-AUD-04 but nothing sets it — no impersonation feature exists yet.
