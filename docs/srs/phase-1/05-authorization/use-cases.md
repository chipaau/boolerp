# 05 — Authorization (Cerbos) — Use Cases

**Status:** 🟡 In Review. Actors: **Chi** (PDP caller), **Tenant admin** (Control Centre),
**Operator** (`apps/admin`, internal tenant), **Cerbos**.

---

## UC-AUTHZ-01 — Authorize a request *(system)*
- **Trigger:** any mutating (and gated read) API call. · **Main flow:** Chi builds the principal
  (user + active tenant + roles + caps + `is_internal_member`) → calls Cerbos with `(resource, action)` →
  allow/deny. · **Exceptions:** deny → 403. · **Postcondition:** only authorized actions proceed.

## UC-AUTHZ-02 — Define / edit a per-tenant role *(Tenant admin)*
- **Main flow:** create a role from a seeded template (or blank) in Control Centre. · **Postcondition:** a tenant-scoped role.

## UC-AUTHZ-03 — Assign / remove capabilities on a role *(Tenant admin)*
- **Main flow:** edit `role_capabilities`; changes take effect **immediately** (Cerbos is live). · **Postcondition:** role's caps updated.

## UC-AUTHZ-04 — Assign / remove a role to a member *(Tenant admin)*
- **Main flow:** edit `user_roles` for a `tenant_users` membership. · **Exceptions:** cannot exceed the
  assigner's own level. · **Postcondition:** member's effective capabilities updated immediately.

## UC-AUTHZ-05 — Operator platform-wide action *(Operator, internal tenant)*
- **Trigger:** operator provisions/suspends a tenant or runs a platform op. · **Main flow:** Cerbos allows
  because the principal is an `is_internal_member` holding the `platform:*` cap. · **Exceptions:** non-internal
  principal with the same cap slug → denied (scoped to their tenant). · **Postcondition:** platform action performed by an authorized operator.

## UC-AUTHZ-06 — Four-eyes internal-tenant role change *(Operator ×2)*
- **Main flow:** operator A proposes a change to an internal-tenant role/assignment → operator B (distinct)
  approves → applied. · **Exceptions:** same person cannot approve own proposal. · **Postcondition:** change applied under a full audit trail.

## UC-AUTHZ-07 — Grant support access *(Operator ×2 → enables UC-AUTH-14)*
- **Trigger:** operator requests support access to a tenant/user (reason, target, duration). · **Main flow:**
  recorded in `access_grants` (`proposed`); a second operator approves (`approved`) → a **time-boxed**
  grant exists → UC-AUTH-14 impersonation may run. · **Exceptions:** no approval → no access; expiry → revoked.
- **Postcondition:** a consented, expiring, audited support grant.

## UC-AUTHZ-08 — Seed capability catalog + default role templates *(system, bootstrap)*
- **Trigger:** migrate/first-run. · **Main flow:** code-seed the capability catalog + default per-tenant
  role templates (owner/admin/member). · **Postcondition:** authz is usable from day one.

---

## ⚠️ Open items
- ~~Confirm the Phase-1 capability catalog~~ — resolved 2026-09-02: use as proposed (`srs.md`).
- ~~Four-eyes approver selection rule~~ — resolved 2026-09-02: any two distinct internal-tenant admins.
- ~~Whether tenant-level role management also needs four-eyes~~ — resolved 2026-09-02: no, internal only.
- Use-case inventory itself (this list, UC-AUTHZ-01…08) not yet re-reviewed for completeness — still
  blocks bumping this component to 🟢 Confirmed.
