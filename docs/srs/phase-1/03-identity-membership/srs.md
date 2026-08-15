# 03 — Identity & Membership — SRS

**Status:** 🟡 In Review &nbsp;·&nbsp; *Who* a person is (global) and *which tenants* they belong to.
Tenant-facing UI lives in **Control Centre** (`apps/app`); operator provisioning in `apps/admin`.

## Confirmed decisions (2026-08-13)
- **One global identity per person** — `platform.users.id` = Kratos subject; email unique in Kratos.
  The same person across tenants is the **same identity** with multiple memberships.
- **Seats:** **tracked now, enforced in Phase 2** (billing). Control Centre shows used vs committed; no hard block yet.
- **Invites** reuse the Kratos activation/recovery link (app-initiated); no separate credential handling.
- **Disable** a member → **revoke sessions** (UC-AUTH-11). Removal and disable are **soft** (audit retained).

## Functional requirements
| ID | Requirement |
|---|---|
| FR-MEM-01 | Mirror the Kratos identity into `platform.users` (`id` = subject); **JIT-upsert** in middleware if missing. |
| FR-MEM-02 | `tenant_users` membership: `user_id` + `tenant_id`, `status` (invited/active/disabled), `is_owner`, `joined_at`; `unique(user_id, tenant_id)`. |
| FR-MEM-03 | **Invite** a member (Control Centre): create the identity if new (Kratos admin API) + membership `invited` + activation link; existing user → membership `invited` directly. |
| FR-MEM-04 | **Activate** membership (via UC-AUTH-01) → `active`. |
| FR-MEM-05 | **Disable / re-enable** a member; disable revokes sessions and fails the membership check (404/403). |
| FR-MEM-06 | A user with multiple active memberships **switches active tenant**. |
| FR-MEM-07 | Exactly **one owner** per tenant; **ownership transfer** to another active member, audited. |
| FR-MEM-08 | **Seat tracking**: `tenants.seats` (committed) vs used (invited + active); surfaced in Control Centre. **No enforcement in Phase 1.** |
| FR-MEM-09 | **Remove** a member (soft) — membership soft-deleted; identity persists (may belong to other tenants); audit retained. |

## Non-functional / notes
- Membership changes are audited (→ 06). Role assignment is a separate concern (→ 05).
- Party/national-ID registry dedup (same person known to two tenants) is a **platform** concern, tracked separately — not blocking here.

## Open (resolve before 🟢)
- [ ] Ownership transfer: self-serve by current owner, or operator-assisted? (default: self-serve, audited)
- [ ] Invite expiry + resend policy.
- [ ] Does removing the last owner require transfer first? (default: yes — cannot remove the sole owner)

## Use cases
See [`use-cases.md`](use-cases.md) — UC-MEM-01 … UC-MEM-09. Each ships with unit + integration +
Playwright e2e per `testing.md` (incl. a cross-tenant isolation test on membership).
