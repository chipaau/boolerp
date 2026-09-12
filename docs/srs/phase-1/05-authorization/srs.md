# 05 — Authorization (Cerbos) — SRS

**Status:** 🟡 In Review &nbsp;·&nbsp; **Cerbos = enforcement (PDP)**; the app owns role/capability
**administration**. Consulted live on every request — never baked into a token.

## Confirmed decisions (2026-08-13)
- **Internal/operator tenant: in Phase 1** (needed for provisioning, support access, platform ops).
  Seeded at first-run (01). Only `platform:*` capabilities held via **internal-tenant** roles act
  platform-wide (Cerbos requires the `is_internal_member` principal attribute).
- **Four-eyes** on internal-tenant role changes **and** support-access grants (two distinct internal admins).
- Capability catalog is **code-seeded** (single source); Cerbos policies are **versioned in the repo**
  (`docker/cerbos/policies`, reviewed via PR).

## Functional requirements
| ID | Requirement |
|---|---|
| FR-AUTHZ-01 | Cerbos consulted **live per request**, deny-by-default. Principal = user + active tenant + roles + capabilities + attrs (`is_internal_member`, oversight context). |
| FR-AUTHZ-02 | **Capability catalog** code-seeded; `(resource, action)` → policy decision. Tenants create roles without policy redeploys. |
| FR-AUTHZ-03 | Per-tenant **roles** from seeded templates; `role_capabilities`; `user_roles` assigns roles to members. |
| FR-AUTHZ-04 | **Internal/operator tenant** (`is_internal`): `platform:*` caps via internal roles are platform-wide; domain caps stay tenant-scoped. |
| FR-AUTHZ-05 | **Four-eyes** on internal-tenant role changes + support-access grants (propose → second internal admin approves). |
| FR-AUTHZ-06 | **Support access (impersonation)** authorization: `platform:support:access` cap + four-eyes + a **time-boxed** grant → enables UC-AUTH-14; every action audited (→ 06). |
| FR-AUTHZ-07 | `/bootstrap` capability hints are **UI-advisory only**; Cerbos enforces server-side on every mutation. |
| FR-AUTHZ-08 | Cerbos policies live in `docker/cerbos/policies`, versioned + PR-reviewed. |

## Phase-1 capability catalog — ✅ confirmed 2026-09-02, as proposed
- **Members:** `members:invite`, `members:manage`, `members:transfer-ownership`
- **Roles:** `roles:manage`, `roles:assign`
- **Tenant:** `tenant:manage-settings`, `tenant:manage-visibility`, `tenant:manage-hierarchy` *(operator)*
- **Audit:** `audit:view`
- **Platform (internal only):** `platform:tenants:provision`, `platform:tenants:suspend`,
  `platform:support:access`, `platform:*`

## Resolved 2026-09-02
- Four-eyes approver: **any two distinct internal-tenant admins** (no dedicated approver role).
- Tenant-level role management: **no four-eyes** — internal-tenant only.
- `platform:*` misassignment to a non-internal tenant's role: **no DB-level guard** — Cerbos's
  `is_internal_member` principal check is the sole enforcement (deliberate; not defense-in-depth).

## Data model — ✅ approved 2026-09-02, revised 2026-09-12 (table-by-table, see `docs/data-model/DB-FOUNDATION.md`)
- `roles`, `role_capabilities`, `user_roles` (control-plane, not RLS-scoped — group A); `roles` is
  now **app-scoped** (`app_id` + nullable `tenant_id` — NULL is a global template shared by every
  tenant with the app activated, set is that tenant's own custom role).
- **Role-assignment four-eyes** (UC-AUTHZ-06, opt-in per tenant via `tenant_settings`) uses
  **`role_requests`** (`pending_review → pending_approval → approved/rejected/expired`). This
  replaced the earlier separate `role_change_proposals` table (dropped 2026-09-12) — its one
  confirmed use case, internal-tenant role assignment, is fully covered by `role_requests`.
- **Support-access four-eyes** (UC-AUTHZ-07 → UC-AUTH-14) uses **`support_access_grants`** (renamed
  from `access_grants` 2026-09-12; `pending_review → pending_approval → approved → revoked`, plus
  tenant-notify/tenant-approve fields since this grants access into a *different* tenant's data).
- Capability catalog is code-seeded. Cerbos policies in `docker/cerbos/`.

## Use cases
See [`use-cases.md`](use-cases.md) — UC-AUTHZ-01 … UC-AUTHZ-08 (each with unit + integration + e2e per `testing.md`).
