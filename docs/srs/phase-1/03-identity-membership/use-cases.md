# 03 — Identity & Membership — Use Cases

**Status:** 🟡 In Review. Actors: **Tenant admin** (in Control Centre), **Member**, **Operator**
(`apps/admin`), **Chi**, **Kratos**.

---

## UC-MEM-01 — Provisioning creates the owner *(system, cross-ref UC-TEN-01 / UC-FND-02)*
- **Trigger:** a tenant is provisioned. · **Main flow:** Chi creates the owner identity (Kratos admin) →
  `platform.users` row → `tenant_users` membership `active`, `is_owner=true`. · **Postcondition:** tenant has one owner.

## UC-MEM-02 — Invite a member *(Tenant admin, Control Centre)*
- **Trigger:** admin invites `email` with a role. · **Preconditions:** admin has the manage-members capability.
- **Main flow:**
  1. If no identity exists for `email` → create it (Kratos admin API).
  2. Create `tenant_users` membership `invited` (+ initial role assignment → 05).
  3. Send an activation link; seat usage increments (tracked, not enforced).
- **Exceptions:** already a member → error; identity exists in another tenant → reuse it (one global identity).
- **Postcondition:** an invited membership awaiting activation.

## UC-MEM-03 — Invited member activates *(Member)*
- **Trigger:** clicks the activation link → **UC-AUTH-01**. · **Main flow:** sets credential; membership → `active`.
- **Postcondition:** member can log in and access the tenant.

## UC-MEM-04 — Disable / re-enable a member *(Tenant admin)*
- **Main flow:** admin disables a member → membership `disabled` + **sessions revoked** (UC-AUTH-11);
  re-enable → `active`. · **Exceptions:** cannot disable the sole owner (transfer first).
- **Postcondition:** disabled members are blocked at the membership check within one request cycle.

## UC-MEM-05 — Remove a member *(Tenant admin)*
- **Main flow:** soft-delete the membership; identity persists; audit retained. · **Exceptions:** cannot
  remove the sole owner. · **Postcondition:** member no longer belongs to this tenant; seat freed.

## UC-MEM-06 — Switch active tenant *(Member)*
- **Trigger:** a multi-tenant user moves between tenants. · **Main flow:** user selects/navigates to another
  tenant they’re an active member of; the App re-bootstraps for that tenant. · **Exceptions:** no active
  membership → no-access + switcher (403). · **Postcondition:** user operating under the chosen tenant.

## UC-MEM-07 — Transfer ownership *(Owner / Tenant admin)*
- **Trigger:** owner transfers to another **active** member. · **Main flow:** current owner nominates a target
  active member → `is_owner` moves; audited. · **Exceptions:** target not active → blocked. · **Postcondition:**
  exactly one owner; the change is in the audit trail.

## UC-MEM-08 — JIT-upsert user *(system)*
- **Trigger:** first `whoami` for an identity with no `platform.users` row (e.g. OIDC signup). · **Main flow:**
  Chi upserts `users` from the identity traits. · **Postcondition:** `users` self-heals; no drift vs Kratos.

## UC-MEM-09 — View seat usage *(Tenant admin, Control Centre)*
- **Trigger:** admin opens members/seat view. · **Main flow:** show **used** (invited + active) vs
  **committed** (`tenants.seats`); a "buy more" prompt is display-only in Phase 1. · **Postcondition:**
  usage visible; **no enforcement** (Phase 2 blocks over-seat invites).

---

## ⚠️ Open items
- Ownership-transfer authority (self-serve vs operator-assisted).
- Invite expiry + resend.
- Sole-owner protection wording (must transfer before disable/remove — default yes).
