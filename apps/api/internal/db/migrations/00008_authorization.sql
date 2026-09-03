-- Authorization (component 05) — role/capability administration + four-eyes-gated sensitive actions.
-- Cerbos is the PDP (enforcement); these tables are the app's administration surface it reads from.
-- Platform control-plane (cross-tenant by nature — role administration reads across tenant switches),
-- NOT under the tenant RLS regime, same as tenants/tenant_users (see tenancy.md).
-- +goose Up

-- tenant_users needs (tenant_id, id) as an FK target so user_roles can carry a composite FK proving
-- a role and the membership it's assigned to belong to the SAME tenant — closes an authorization
-- gap a plain tenant_user_id+role_id pair can't: without this, a bug in principal-building (joining
-- user_roles -> roles without also checking roles.tenant_id) could let a member inherit another
-- tenant's role/capabilities. id is already globally unique, so this composite adds no new constraint
-- semantics beyond the pairing table below.
ALTER TABLE tenant_users ADD CONSTRAINT uq_tenant_users_tenant_id UNIQUE (tenant_id, id);

-- roles — per-tenant. The internal/operator tenant's roles are just roles where tenant_id = the one
-- is_internal tenant; platform:* capabilities only act platform-wide when held via such a role
-- (Cerbos's is_internal_member principal attribute makes this authoritative, not this table alone).
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

-- user_roles — assigns a role to a tenant_users membership (not directly to a user: a role only
-- means something within that membership's tenant). tenant_id is denormalised solely to make the
-- two composite FKs below possible.
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

-- access_grants — support access / impersonation only (UC-AUTHZ-07 -> UC-AUTH-14). Time-boxed,
-- four-eyes gated (approved_by must differ from proposed_by).
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

-- role_change_proposals — internal-tenant role/capability/assignment four-eyes (UC-AUTHZ-06). No
-- tenant_id: always implicitly the one internal tenant, nothing to scope.
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

-- +goose Down
DROP TABLE IF EXISTS role_change_proposals;
DROP TABLE IF EXISTS access_grants;
DROP TABLE IF EXISTS user_roles;
DROP TABLE IF EXISTS role_capabilities;
DROP TABLE IF EXISTS roles;
ALTER TABLE tenant_users DROP CONSTRAINT IF EXISTS uq_tenant_users_tenant_id;
