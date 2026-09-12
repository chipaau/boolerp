-- Authorization (component 05) — role/capability administration + four-eyes-gated sensitive actions.
-- Cerbos is the PDP (enforcement); these tables are the app's administration surface it reads from.
-- Platform control-plane (cross-tenant by nature — role administration reads across tenant switches),
-- NOT under the tenant RLS regime, same as tenants/tenant_users (see tenancy.md).
-- +goose Up

-- apps — the ERP workspace's app catalog (Control Centre, Inventory, HRMS, Procurement, Performance, …).
-- Pulls forward the module_activations concept tenant_apps below was already reserving a slot for —
-- needed now because roles is app-scoped.
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

-- Seed: the minimal app catalog provisioning needs today, not a confirmed full catalog —
-- Inventory/HRMS/Procurement/Performance land with their own components. control-centre is the
-- one needed now: the internal tenant's operator role must belong to an app, per roles.app_id.
INSERT INTO apps (code, name) VALUES
  ('control-centre', 'Control Centre')
ON CONFLICT (code) DO NOTHING;

-- tenant_apps — which apps a tenant has activated.
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

-- tenant_settings — tenant-wide configuration toggles (requires_role_approval,
-- requires_support_access_approval). app_id kept nullable for app-scoped settings expected soon;
-- both settings confirmed so far are tenant-wide (app_id IS NULL). key is code-seeded, not an FK —
-- same treatment as role_capabilities.capability.
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

-- user_apps — which apps a specific user is subscribed to, within a tenant. Separate from holding
-- a role: a user can be subscribed to an app pending role assignment.
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

-- roles — app-scoped, not tenant-scoped: tenant_id NULL = a global role template for that app
-- (shared by every tenant with the app activated); set = that tenant's own custom role for the app,
-- assignable only to that tenant's users (app-enforced — see user_roles). The internal/operator
-- tenant's roles are just custom roles where tenant_id = the one is_internal tenant; platform:*
-- capabilities only act platform-wide when held via such a role (Cerbos's is_internal_member
-- principal attribute makes this authoritative, not this table alone).
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

-- role_capabilities — the capability catalog itself is code-seeded (FR-AUTHZ-02), not a table, so
-- `capability` is a validated string key, not an FK.
CREATE TABLE role_capabilities (
  id          uuid        PRIMARY KEY DEFAULT uuidv7(),
  role_id     uuid        NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  capability  text        NOT NULL,          -- catalog key, e.g. 'members:invite'
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_role_capabilities UNIQUE (role_id, capability)
);
CREATE INDEX ON role_capabilities (role_id);

-- user_roles — assigns a user a role, within a tenant. Both integrity checks the old composite FKs
-- used to provide are now app-enforced (documented, not DB-guaranteed) — necessary once
-- roles.tenant_id became nullable, since a composite FK can't match a real tenant id against a
-- global role's NULL: (1) user_id must be an active member of tenant_id; (2) role_id's role must be
-- visible to tenant_id (global or owned by this exact tenant). active_from/active_to make a grant
-- time-bounded — covers acting appointments as well as standing assignments (active_to IS NULL).
-- Revoking early means setting active_to, not deleting the row.
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

-- role_requests — the 4-eyes path into user_roles, opt-in per the tenant-wide tenant_settings key
-- requires_role_approval. Adapted from a comparable pattern in a sibling project (sentinel-api's
-- access_requests).
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

-- support_access_grants — support access / impersonation (UC-AUTHZ-07 -> UC-AUTH-14): an operator
-- getting time-boxed, audited access into a DIFFERENT tenant's data. target_user_id is always
-- required — even a general data check is framed as viewing-as a specific tenant user. Two-stage
-- (reviewed then a separately distinct approved) to match role_requests, since this guards access
-- into another company's data. The tenant is always notified; whether their own sign-off is
-- required before the grant can proceed is opt-in per tenant via tenant_settings key
-- requires_support_access_approval.
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

-- +goose Down
DROP TABLE IF EXISTS support_access_grants;
DROP TABLE IF EXISTS role_requests;
DROP TABLE IF EXISTS user_roles;
DROP TABLE IF EXISTS role_capabilities;
DROP TABLE IF EXISTS roles;
DROP TABLE IF EXISTS user_apps;
DROP TABLE IF EXISTS tenant_settings;
DROP TABLE IF EXISTS tenant_apps;
DROP TABLE IF EXISTS apps;
