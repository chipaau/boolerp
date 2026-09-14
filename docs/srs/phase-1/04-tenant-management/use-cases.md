# 04 — Tenant Management — Use Cases

**Status:** 🟡 In Review. Actors: **Operator** (`apps/admin`), **Tenant admin** (Control Centre),
**Chi**, **Onboarding** (08, system).

---

## UC-TEN-01 — Provision a tenant (operator) *(Operator)*
- **Trigger:** operator creates a tenant in `apps/admin`. · **Main flow:** validate slug/party-type →
  **provisioning engine** (FR-TEN-01): tenant → owner identity → owner membership → seed roles →
  activation link. · **Exceptions:** slug taken → reject; any step fails → full rollback (no squatted slug).
- **Postcondition:** an `active` tenant with an owner awaiting activation.

## UC-TEN-02 — Provision via self-serve onboarding *(Onboarding 08 → engine)*
- **Trigger:** a paid website application succeeds (08). · **Main flow:** onboarding calls the **same
  provisioning engine**; on success the subscription is linked (08). · **Exceptions:** payment/provision
  failure → teardown (08). · **Postcondition:** tenant live from the self-serve flow.

## UC-TEN-03 — Suspend / reactivate / archive *(Operator)*
- **Main flow:** operator changes status; **suspend** blocks access + revokes sessions (UC-AUTH-11);
  **archive** ends the lifecycle (retention per policy). · **Exceptions:** the tenant's current status
  doesn't permit the action (e.g. reactivating an archived tenant) → **409**, naming the blocking status;
  unknown tenant id → **404**. Neither is reported as a server error. · **Postcondition:** access reflects
  status within one request cycle.

## UC-TEN-04 — Place a tenant under a parent *(Operator)*
- **Main flow:** set `parent_id` + `oversight`; build `path` from `tree_key`s. If `subordinate` →
  **auto** aggregate grant (UC-TEN-07). · **Exceptions:** cycle → rejected. · **Postcondition:** tenant in the tree with its oversight edge.

## UC-TEN-05 — Re-parent a subtree *(Operator)*
- **Main flow:** move a node + subtree under a new parent → ltree **prefix swap** in one tx; descendant
  paths recomputed. · **Exceptions:** moving under own descendant → rejected (cycle). · **Postcondition:** subtree re-homed; labels unchanged.

## UC-TEN-06 — Establish visibility by mutual agreement *(Tenant admins, both sides)*
- **Trigger:** an `affiliated` edge, or any `detail`-scope sharing. · **Preconditions:** the two tenants are
  **ancestor↔descendant**; each admin holds manage-visibility. · **Main flow:**
  1. Tenant A proposes a grant (scope + modules).
  2. Tenant B **accepts** (bilateral consent, platform-brokered).
  3. Grant becomes `active` and enters the visible-set resolution.
- **Exceptions:** not in hierarchy → not allowed; B declines → no grant. · **Postcondition:** a consented, auditable visibility grant.

## UC-TEN-07 — Auto aggregate grant for a subordinate child *(system)*
- **Trigger:** a `subordinate` edge is created (UC-TEN-04). · **Main flow:** system creates an aggregate
  grant (`source=hierarchy`, `granted_by NULL`). · **Postcondition:** parent sees the child's roll-ups without a manual step.

## UC-TEN-08 — Parent views authorized roll-ups *(Tenant admin, parent)*
- **Trigger:** parent opens a cross-facility view. · **Main flow:** app resolves `app.visible_tenants`
  (own ∪ authorized descendants) → reads span the visible set (UC-FND-07); aggregate/detail per grant.
- **Exceptions:** no active grant → only own tenant. · **Postcondition:** parent sees exactly its authorized set — DB-enforced.

## UC-TEN-09 — Revoke / expire a visibility grant *(Either tenant admin / system)*
- **Main flow:** either party revokes, or the active window lapses → grant leaves the visible set immediately.
- **Postcondition:** visibility withdrawn; change audited.

---

## ⚠️ Open items
- Manage-visibility capability holder (ties to 05).
- Re-parenting authority (default: operator only).
- Archival retention policy.
