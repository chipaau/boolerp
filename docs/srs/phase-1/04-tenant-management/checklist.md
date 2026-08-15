# 04 — Tenant Management — Confirmation Checklist

**Status:** 🟡 In Review &nbsp;·&nbsp; Tenant lifecycle + **hierarchy** + **visibility/oversight**. `srs.md` + `use-cases.md` drafted.

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
- [ ] Scope confirmed &nbsp; [ ] Open questions resolved &nbsp; [ ] Use-case inventory complete
