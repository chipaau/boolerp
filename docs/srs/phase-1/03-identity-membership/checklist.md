# 03 — Identity & Membership — Confirmation Checklist

**Status:** 🟡 In Review &nbsp;·&nbsp; *Who* a person is (global) and *which tenants* they belong to. `srs.md` + `use-cases.md` drafted.

## Scope
- **In:** global `users` (mirror of Kratos identity), `tenant_users` memberships, member invite +
  lifecycle (invited → active → disabled), the tenant **owner**, refresh of the `users` mirror in middleware
  (verify-only — middleware never creates a user).
- **Out:** login/sessions (→ 02); roles/permissions (→ 05); tenant creation (→ 04).

## Candidate use cases
- UC-MEM-01 — Provisioning creates the owner identity (Kratos admin API) + `users` + owner membership
- UC-MEM-02 — Invite a member to a tenant (creates identity if new, membership, recovery link)
- UC-MEM-03 — Accept invite / activate
- UC-MEM-04 — Disable / re-enable a member (triggers session revocation via 02)
- UC-MEM-05 — A user switches active tenant (multi-tenant membership)
- UC-MEM-08 — Refresh the `users` mirror on sign-in; **refuse (403) an identity with no `users` row**

## ⚠️ Likely-missing / confirm
- Seat enforcement (committed prepaid seats — or is that Phase 2 billing?)
- Removing a member vs disabling (soft) — retention/audit rules
- Same person across tenants: one global identity (confirmed) — dedup policy?

## Open questions
- [x] Seats: **tracked in Phase 1, enforced in Phase 2** (confirmed 2026-08-13).
- [x] Invite delivery: **Kratos activation/recovery link**, app-initiated.
- [x] One global identity per person; same person across tenants = same identity + memberships.
- [ ] Ownership transfer: self-serve by owner vs operator-assisted? (default: self-serve, audited)
- [ ] Invite expiry + resend policy.
- [ ] Sole-owner protection: must transfer before disable/remove? (default: yes)

## Data-model touchpoints
- `users`, `tenant_users` (group A).

## Sign-off
- [ ] Scope confirmed &nbsp; [ ] Open questions resolved &nbsp; [ ] Use-case inventory complete
