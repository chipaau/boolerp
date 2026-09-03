# 05 — Authorization (Cerbos) — Confirmation Checklist

**Status:** 🟡 In Review &nbsp;·&nbsp; Cerbos = enforcement (PDP); app = role/capability administration. `srs.md` + `use-cases.md` drafted.

## Scope
- **In:** Cerbos integration (live per-request check, principal built from memberships/roles);
  capability catalog (code-seeded); role + `role_capabilities` + `user_roles` administration;
  the **internal/operator-tenant** model (only `platform:*` caps via internal roles act platform-wide).
- **Out:** authN (→ 02); membership (→ 03); policy content per business module (later, per module).

## Candidate use cases
- UC-AUTHZ-01 — API authorizes a request via Cerbos (principal + resource + action → allow/deny)
- UC-AUTHZ-02 — Define a per-tenant role from a seeded template
- UC-AUTHZ-03 — Assign/remove capabilities on a role
- UC-AUTHZ-04 — Assign/remove a role to a member
- UC-AUTHZ-05 — Operator (internal tenant) performs a platform-wide action
- UC-AUTHZ-06 — Bootstrap: how the capability catalog + default role templates are seeded

## ⚠️ Likely-missing / confirm
- Four-eyes on internal-tenant role changes (erp guardrail) — Phase 1?
- Where Cerbos policies live/version (repo `docker/cerbos/policies`) + review process
- UI-gating caps in `/bootstrap` are advisory only; Cerbos enforces — confirm both paths

## Open questions
- [x] Internal/operator-tenant model: **Phase 1** (needed for provisioning + support access).
- [x] Four-eyes on internal-tenant role changes + support-access grants: **yes**.
- [x] Support-access + four-eyes lifecycle uses **`access_grants`** — this is UC-AUTH-14's record.
  Internal-tenant role-change four-eyes (UC-AUTHZ-06) uses a **separate** `role_change_proposals`
  table — different-shaped record, same four-eyes workflow (confirmed 2026-09-02).
- [x] Confirm the proposed Phase-1 **capability catalog**: **use as proposed** (confirmed 2026-09-02, see `srs.md`).
- [x] Four-eyes approver selection: **any two distinct internal-tenant admins** (confirmed 2026-09-02).
- [x] Tenant-level role management four-eyes: **no — internal only** (confirmed 2026-09-02).

## Data-model touchpoints
- `roles`, `role_capabilities`, `user_roles`, `access_grants`, `role_change_proposals` — ✅ approved
  2026-09-02, table-by-table, see `docs/data-model/DB-FOUNDATION.md`. Cerbos policies live in `docker/cerbos/`.

## Sign-off
- [x] Scope confirmed &nbsp; [x] Open questions resolved &nbsp; [ ] Use-case inventory complete
