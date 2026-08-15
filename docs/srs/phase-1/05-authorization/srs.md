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

## Proposed Phase-1 capability catalog (confirm)
- **Members:** `members:invite`, `members:manage`, `members:transfer-ownership`
- **Roles:** `roles:manage`, `roles:assign`
- **Tenant:** `tenant:manage-settings`, `tenant:manage-visibility`, `tenant:manage-hierarchy` *(operator)*
- **Audit:** `audit:view`
- **Platform (internal only):** `platform:tenants:provision`, `platform:tenants:suspend`,
  `platform:support:access`, `platform:*`

## Open (resolve before 🟢)
- [ ] Confirm the Phase-1 capability catalog above (add/remove).
- [ ] Four-eyes approver selection (default: any two distinct internal-tenant admins).
- [ ] Does tenant-level role management need four-eyes, or only internal-tenant? (default: internal only)

## Data model
- `roles`, `role_capabilities`, `user_roles` (group A). **Support-access + four-eyes lifecycle uses
  `access_grants`** (group D: `proposed → pending_approval → approved → revoked`) — this is the record
  UC-AUTH-14 needs. Capability catalog is code-seeded. Cerbos policies in `docker/cerbos/`.

## Use cases
See [`use-cases.md`](use-cases.md) — UC-AUTHZ-01 … UC-AUTHZ-08 (each with unit + integration + e2e per `testing.md`).
