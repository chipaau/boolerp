# 04 — Tenant Management — Confirmation Checklist

**Status:** 🟡 Partially Implemented (2026-09-12) &nbsp;·&nbsp; **Flat tenant CRUD is built**: provisioning
(`internal/tenancy.Provision` — tenant → owner identity via Kratos recovery link → owner membership,
atomic, tears down on failure) and the status lifecycle (`SuspendTenant`/`ReactivateTenant`/
`ArchiveTenant`, each atomically audited), exposed via `/api/v1/admin/tenants` and a real
`apps/admin` UI. **Hierarchy and visibility/oversight are deliberately deferred** — no
`tenant_visibility_grants` table exists yet (never reviewed table-by-table), no `parent_id`/
`tree_key` UI, no parent-tenant use case to validate against. Revisit as its own pass.

## Scope
- **In:** tenant CRUD + provisioning; slug/code; party-type classification; status
  (provisioning/active/suspended/archived) + suspension effects; hierarchy (`parent_id` + `tree_key`
  + `path` ltree, re-parenting); **visibility & oversight** (`tenant_visibility_grants`, `oversight`
  subordinate/affiliated, scope aggregate/detail, per-module) feeding the `app.visible_tenants` RLS set;
  `connection_key` routing.
- **Out:** billing/subscription (Phase 2); membership (→ 03); Cerbos policies (→ 05).

## Candidate use cases
- UC-TEN-01 — Provision a tenant (operator/CLI): create tenant → owner identity → membership
- UC-TEN-02 — Suspend / reactivate / archive a tenant (suspension blocks access, revokes sessions)
- UC-TEN-03 — Place a tenant under a parent (set `parent_id`, derive `oversight`, build `path`)
- UC-TEN-04 — Re-parent a subtree (ltree prefix swap)
- UC-TEN-05 — Parent views aggregate roll-ups across authorized descendants (visible-set read)
- UC-TEN-06 — Child authorises a detail-scope grant to a parent (`child_authoriser`)
- UC-TEN-07 — Auto aggregate grant created for a `subordinate` child at provisioning

## ⚠️ Likely-missing / confirm
- Who may provision tenants (operator only? self-serve is Phase 2)
- Cross-deployment aggregation (subtree split by `connection_key`) — Phase 1 or later?
- Grant expiry / revocation flow; audit of visibility changes
- Immutable `slug` policy after go-live

## Open questions
- [x] Provisioning triggers: operator (`apps/admin`) + **self-serve onboarding (08)** + on-prem first-run (01).
- [x] `connection_key`: **stubbed to `primary`** in Phase 1 (seam only).
- [x] Visibility: **hierarchy-bounded**; `subordinate` → **auto** aggregate; `affiliated` + detail → **mutual agreement** (propose→accept).
- [ ] Manage-visibility capability holder per side (default: owner/admin — ties to 05).
- [ ] Re-parenting authority (default: operator only).
- [ ] Archival retention policy.

## Data-model touchpoints
- `tenants`, `tenant_visibility_grants`, `party_types` (group A).

## Sign-off
- [x] Scope confirmed (flat CRUD) &nbsp; [ ] Open questions resolved (hierarchy/visibility ones remain
  genuinely open, not just unchecked) &nbsp; [ ] Use-case inventory complete
- [~] **Partially implemented** (2026-09-12): UC-TEN-01 (provision) and UC-TEN-02 (suspend/
  reactivate/archive) only — `internal/tenancy/{provision,lifecycle}.go` +
  `internal/httpapi/admin_tenants.go` + `apps/admin`'s Tenants page, all tested (Go integration +
  Playwright e2e). UC-TEN-03 through 09 (hierarchy, re-parenting, visibility grants) not started.
