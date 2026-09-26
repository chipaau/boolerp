# 05 — Authorization (Cerbos) — Confirmation Checklist

**Status:** 🟡 Partially Implemented (2026-09-12) &nbsp;·&nbsp; Cerbos = enforcement (PDP); app = role/capability
administration. UC-AUTHZ-01 and 05 are built and tested: `auth.Authorize`/`BuildOperatorPrincipal`
(real `user_roles`/`role_capabilities`, not a hardcoded role) and `httpapi.AdminRoute` (the
fail-closed per-handler wrapper — every admin route's Cerbos check is inside the wrapper itself, not
something a handler author can forget). `docker/cerbos/policies/resource_tenant.yaml` is the first
real policy beyond the `profile`/`self` scaffold. UC-AUTHZ-02/03/04 (tenant admin defining/editing
their own roles in Control Centre) and 06 (seeding default role templates) are not built.

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
- [x] Support-access + four-eyes lifecycle uses **`support_access_grants`** (renamed from
  `access_grants` 2026-09-12) — this is UC-AUTH-14's record. Role-assignment four-eyes (UC-AUTHZ-06)
  uses **`role_requests`**, which replaced the earlier separate `role_change_proposals` table
  (dropped 2026-09-12 — its one confirmed use case is fully covered by `role_requests`).
- [x] Confirm the proposed Phase-1 **capability catalog**: **use as proposed** (confirmed 2026-09-02, see `srs.md`).
- [x] Four-eyes approver selection: **any two distinct internal-tenant admins** (confirmed 2026-09-02).
- [x] Tenant-level role management four-eyes: **no — internal only** (confirmed 2026-09-02).

## Data-model touchpoints
- `roles`, `role_capabilities`, `user_roles`, `role_requests`, `support_access_grants` — ✅ approved
  2026-09-02, revised 2026-09-12, table-by-table, see `docs/data-model/DB-FOUNDATION.md`. Cerbos
  policies live in `docker/cerbos/`.

## Sign-off
- [x] Scope confirmed &nbsp; [x] Open questions resolved &nbsp; [ ] Use-case inventory complete
- [~] **Partially implemented** (2026-09-12): UC-AUTHZ-01 + 05 (see status line above), tested in
  `internal/auth/authz_integration_test.go` + `internal/httpapi/admin_route_integration_test.go`.
  UC-AUTHZ-02/03/04/06 remain, tied to Control Centre (tenant-facing role admin UI) not yet built.
