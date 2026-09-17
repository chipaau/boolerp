-- Platform tenancy — control-plane (not tenant-scoped). Used by provisioning (cmd/provision-dev).

-- name: GetPartyTypeIDByCode :one
-- Global (country_code IS NULL) party types only — the app never provisions a jurisdiction-specific form here.
SELECT id FROM party_types WHERE country_code IS NULL AND code = $1;

-- name: GetInstitutionTypeIDByCode :one
-- institution_types is "global set + country overrides" (e.g. 'council' is MV-only, 'business' is
-- global/NULL). An exact country_code = $1 match would never resolve a global row for a real
-- country argument (NULL = 'MV' is never true) — prefer a country-specific override if one exists
-- for this code, else fall back to the global row.
SELECT id FROM institution_types
WHERE (country_code = $1 OR country_code IS NULL) AND code = $2
ORDER BY country_code NULLS LAST
LIMIT 1;

-- name: GetTenantBySlug :one
SELECT * FROM tenants WHERE slug = $1;

-- name: GetInternalTenant :one
-- At most one row can ever exist (uq_tenants_one_internal).
SELECT * FROM tenants WHERE is_internal;

-- name: ListTenants :many
-- Operator-facing (apps/admin) tenant list — every tenant, newest first.
SELECT * FROM tenants ORDER BY created_at DESC;

-- name: GetTenantByID :one
SELECT * FROM tenants WHERE id = $1;

-- name: SetTenantStatus :one
-- Reversible status flip (active <-> suspended); does not touch active_to — that's archival only.
-- Guarded on the CURRENT status ($3) so the legal-transition check is atomic rather than a
-- read-then-write two concurrent operators could both win (FR-TEN-03's lifecycle order). No row
-- comes back when the tenant is not in that status — notably, an archived tenant can never be
-- flipped back to active, because archived ends the lifecycle.
UPDATE tenants SET status = sqlc.arg(new_status), updated_at = now()
WHERE id = sqlc.arg(id) AND status = sqlc.arg(current_status)
RETURNING *;

-- name: ArchiveTenant :one
-- Irreversible in this flat-CRUD pass; active_to marks the tenant as ceased (replaces deleted_at).
-- Only a live tenant can be archived: re-archiving would re-stamp active_to and move the ceased date.
UPDATE tenants SET status = 'archived', active_to = now(), updated_at = now()
WHERE id = $1 AND status IN ('active', 'suspended')
RETURNING *;

-- name: NextTenantTreeKey :one
-- Atomic allocation from the sequence (see 00006_tenancy.sql). This was MAX(tree_key)+1, a
-- read-then-insert that two concurrent provisions could both win — one then died on
-- tenants_tree_key_key, reported as a bare 500 because that constraint isn't attributed to a field.
SELECT nextval('tenant_tree_key_seq')::bigint;

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

-- name: GetActiveTenantMembership :one
-- Used by the tenant-resolution middleware: is this user a CURRENT member of this tenant?
-- "Current" is the full validity window, not just the status flag: an 'active' row whose start hasn't
-- arrived (or was never stamped) doesn't grant access yet, and one whose end has passed no longer
-- does. active_to IS NULL means "no end set" — still a member.
SELECT tu.* FROM tenant_users tu
WHERE tu.tenant_id = $1 AND tu.user_id = $2
  AND tu.status = 'active'
  AND tu.active_from IS NOT NULL AND tu.active_from <= now()
  AND (tu.active_to IS NULL OR tu.active_to > now());

-- name: IsInternalTenantMember :one
-- FR-AUTHZ-04: platform:* capabilities only act platform-wide when held via a role on the ONE
-- internal/operator tenant, and only when the caller is genuinely a member of it.
-- Same validity window as GetActiveTenantMembership: an operator whose internal-tenant membership
-- hasn't started or has ended holds no platform-wide capabilities.
SELECT EXISTS (
  SELECT 1 FROM tenant_users tu
  JOIN tenants t ON t.id = tu.tenant_id
  WHERE tu.user_id = $1 AND t.is_internal
    AND tu.status = 'active'
    AND tu.active_from IS NOT NULL AND tu.active_from <= now()
    AND (tu.active_to IS NULL OR tu.active_to > now())
);

-- name: ListActiveCapabilitiesForUserInTenant :many
-- The capability slugs a user currently holds via CURRENT role assignments in one tenant — the
-- principal-building query behind authz.Authorize.
--
-- Grants are time-bounded by design (DB-FOUNDATION: acting appointments can be scheduled ahead), so
-- "current" is the window, not just "has no end date": a grant starting next month must not confer
-- capabilities today, and one with an end date still confers them until that date arrives.
SELECT DISTINCT rc.capability
FROM user_roles ur
JOIN role_capabilities rc ON rc.role_id = ur.role_id
WHERE ur.user_id = $1 AND ur.tenant_id = $2
  AND ur.active_from <= now()
  AND (ur.active_to IS NULL OR ur.active_to > now());

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
