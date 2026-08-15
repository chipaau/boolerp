# 04 — Tenant Management — SRS

**Status:** 🟡 In Review &nbsp;·&nbsp; Tenant lifecycle + **hierarchy** + **visibility/oversight**.
The provisioning **engine** lives here; it is triggered by operators (`apps/admin`), self-serve
website onboarding (08), and on-prem first-run (01).

## Confirmed decisions (2026-08-13)
- **Provisioning triggers:** operator (`apps/admin`) · self-serve website onboarding (08) · on-prem install/first-run (01).
- **Visibility is hierarchy-bounded** (ancestor↔descendant only; no peer sharing).
  - `subordinate` parent edge → **auto** aggregate visibility grant (line authority).
  - `affiliated` edge, and **any detail scope**, → **mutual agreement** (propose → accept, both admins consent, platform-brokered).
- **`connection_key`: stubbed to `primary`** in Phase 1 (routing seam kept, no multi-DB routing yet).
- Provisioning is **transactional** and tears down on failure (no squatted slug).

## Functional requirements
| ID | Requirement |
|---|---|
| FR-TEN-01 | **Provisioning engine:** create tenant → owner identity (03) → owner membership (03) → seed default roles (05); transactional, rolls back fully on failure. |
| FR-TEN-02 | Triggerable by operator (`apps/admin`), onboarding (08), and first-run (01) — one engine, three callers. |
| FR-TEN-03 | Status lifecycle `provisioning → active → suspended → archived`; suspension blocks access + revokes sessions (UC-AUTH-11); middleware rejects non-active. |
| FR-TEN-04 | Tenant profile: `slug` (immutable after go-live), `code`, `party_type` classification, country/locale/timezone, `settings`. |
| FR-TEN-05 | Hierarchy: `parent_id` + immutable `tree_key` + `path` ltree; place under a parent; **re-parent** (ltree prefix swap) with a cycle guard; operator-driven. |
| FR-TEN-06 | `oversight` per parent edge (`subordinate` \| `affiliated`), derived at provisioning, overridable. |
| FR-TEN-07 | `subordinate` edge → **auto** aggregate grant (`source=hierarchy`, `granted_by NULL`). |
| FR-TEN-08 | `affiliated` edge + any `detail` scope → **mutual-agreement** grant: propose → accept (both tenants' admins) → active; **ancestor↔descendant only**. |
| FR-TEN-09 | Grant carries `scope` (aggregate/detail) + `modules[]` + active window; **either party may revoke**; auto-expiry. |
| FR-TEN-10 | **Visible-set resolution:** `app.visible_tenants` = own ∪ (ltree subtree ∩ active grants, per scope/module). Feeds the RLS policy (see `tenancy.md`). |
| FR-TEN-11 | `connection_key` present, stubbed to `primary`; a subtree needing live aggregation stays co-located. |

## Non-functional / notes
- All lifecycle + visibility changes are **audited** (→ 06). Manage-visibility is a capability (→ 05).
- Re-parenting recomputes descendant paths in one transaction.

## Open (resolve before 🟢)
- [ ] Who holds the **manage-visibility** capability on each side? (default: owner/tenant-admin — ties to 05)
- [ ] Re-parenting authority: operator only? (default: yes)
- [ ] Archival data-retention policy.

## Use cases
See [`use-cases.md`](use-cases.md) — UC-TEN-01 … UC-TEN-09. Each ships with unit + integration +
Playwright e2e (incl. a cross-tenant **visibility** isolation test) per `testing.md`.
