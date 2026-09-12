-- Platform tenancy — control-plane (not tenant-scoped). Used by provisioning (cmd/provision-dev).

-- name: GetPartyTypeIDByCode :one
-- Global (country_code IS NULL) party types only — the app never provisions a jurisdiction-specific form here.
SELECT id FROM party_types WHERE country_code IS NULL AND code = $1;

-- name: GetInstitutionTypeIDByCode :one
SELECT id FROM institution_types WHERE country_code = $1 AND code = $2;

-- name: GetTenantBySlug :one
SELECT * FROM tenants WHERE slug = $1;

-- name: GetInternalTenant :one
-- At most one row can ever exist (uq_tenants_one_internal).
SELECT * FROM tenants WHERE is_internal;

-- name: NextTenantTreeKey :one
SELECT (COALESCE(MAX(tree_key), 0) + 1)::bigint FROM tenants;

-- name: CreateTenant :one
-- Root tenant only (parent_id/oversight NULL) — path is a single-label ltree of its own tree_key.
INSERT INTO tenants (
  slug, code, name, party_type_id, institution_type_id, tree_key, path, country, status, is_internal
) VALUES (
  $1, $2, $3, $4, $5, $6, $7::ltree, $8, $9, $10
)
RETURNING *;

-- name: CreateOwnerTenantUser :one
INSERT INTO tenant_users (user_id, tenant_id, status, is_owner, active_from)
VALUES ($1, $2, 'active', true, now())
RETURNING *;

-- name: GetOwnerTenantUser :one
SELECT tu.* FROM tenant_users tu
WHERE tu.tenant_id = $1 AND tu.is_owner AND tu.active_to IS NULL;

-- name: GetAppByCode :one
SELECT * FROM apps WHERE code = $1;

-- name: GetRoleByAppTenantCode :one
-- tenant_id may be NULL (a global template) — a NULL query argument must match a NULL column, so
-- this uses IS NOT DISTINCT FROM rather than =, mirroring the table's own NULLS NOT DISTINCT unique
-- constraint. `tenant_id = $2` would silently never match a global role for a NULL argument (SQL's
-- three-valued logic: NULL = NULL is UNKNOWN, never TRUE).
SELECT * FROM roles WHERE app_id = $1 AND tenant_id IS NOT DISTINCT FROM $2 AND code = $3;

-- name: CreateRole :one
INSERT INTO roles (app_id, tenant_id, code, name)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: CreateRoleCapability :one
INSERT INTO role_capabilities (role_id, capability)
VALUES ($1, $2)
RETURNING *;

-- name: CreateUserRole :one
INSERT INTO user_roles (tenant_id, user_id, role_id, assigned_by)
VALUES ($1, $2, $3, $4)
RETURNING *;
