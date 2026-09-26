# Tenancy

> **Decided 2026-08-13 (erp ADR 0001): pooled multi-tenancy + Postgres RLS; grain = `tenant_id` only.**
> This reverses `../erp`'s schema-per-tenant choice. Rationale: we want **live parent→child
> aggregation** like `../workspace` (native to pooled); `set_config` LOCAL works **through PgBouncer**
> (schema-per-tenant's `search_path` fights the pooler); and **self-host simplicity** (one DB, one
> migration). Schema-per-tenant would only win back if **per-tenant physical isolation or data
> residency** became hard requirements.

## Grain: `tenant_id` only

- Every business table carries `tenant_id uuid NOT NULL`. **No `company_id`.** Each legal entity is
  its own tenant in the hierarchy, so multi-entity consolidation = **parent-tenant aggregation**
  (the same mechanism as ministry oversight). Matches `../workspace` and `../erp`.
- Escape hatch: if a real "one tenant, multiple ledgers sharing master data" need ever appears, add
  `company_id`/`ledger_id` to the *financial* tables specifically — never retrofit the universal grain.

## Invariants

- **The URL is never the security boundary.** Subdomain only *routes*; the real boundary is
  **membership check + RLS**, enforced every request. Resolve tenant from the trusted, proxy-forwarded
  Host; verify the user is an active member (404 if not — don't leak existence).
- **Global identity spans tenants.** One human = one identity; tenant access is via memberships
  (`tenant_users`) + per-tenant roles. Identity lives in Kratos (`users.id` = Kratos subject).
- **Hierarchy = adjacency (`parent_id`) + `path ltree` with an immutable `bigint tree_key` label**
  (UUID v7 PKs can't be ltree labels — hyphens illegal). Re-parenting = ltree prefix swap.
- **Parent visibility = "visible set = own tenant ∪ authorized descendants"**, descendants = ltree
  subtree ∩ consent. Carry `../erp`'s granularity: `oversight` (subordinate ⇒ auto aggregate,
  affiliated ⇒ explicit), scope (aggregate/detail), per-module grants (`tenant_visibility_grants`).
- **Gapless document numbering** (invoices, POs, IUL series) via a locked per-series counter row in
  the issuing transaction — never a Postgres sequence (they gap on rollback).
- **Tenant-scope everything:** cache keys and object-storage paths are tenant-prefixed. No shared leakage.
- **Never a global "current tenant".** It's a data race across goroutines — tenant lives in
  `context.Context`, passed explicitly.

## Pooled + RLS mechanics

- `WithTenant(ctx, tenantID, fn)` opens a tx and runs
  `SELECT set_config('app.current_tenant', $1, true)` (**LOCAL** — never leaks across the pool),
  then `fn`. All HTTP handlers **and background jobs** go through it.
- **One policy unifies isolation + parent visibility** (reads = visible set, writes = active tenant):
  ```sql
  USING      (tenant_id = ANY (current_setting('app.visible_tenants')::uuid[]))
  WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid)
  ```
  `app.visible_tenants` = `[current_tenant]` normally; `[current_tenant, …authorized descendants]`
  only when a parent explicitly enters aggregation mode (descendants resolved from ltree subtree ∩
  `tenant_visibility_grants`). Kills the workspace model's `withoutGlobalScopes()` leak seam.
- Column `DEFAULT current_setting('app.current_tenant')::uuid` on `tenant_id` so queries never
  mention it and can't leak.
- **Hard requirements:** app connects as a **non-owner** role; `FORCE ROW LEVEL SECURITY` on every
  tenant table; a CI test that fails if any tenant-scoped table lacks a policy.
- **Composite FKs including `tenant_id`** make cross-tenant references impossible at the DB level.
- Deployment follows tenant subtrees via a `connection_key`-style route (SaaS regional cluster /
  on-prem instance / promoted heavy tenant). Invariant: a subtree needing live parent aggregation
  stays co-located in one database.

## Platform vs business tables

- **Platform/control-plane tables** (`tenants`, `users`, `tenant_users`, `tenant_visibility_grants`,
  `roles`, …) are cross-tenant by nature (tenant switching, membership resolution) — **not** under
  the tenant RLS regime.
- **Business/module tables** are tenant-scoped and carry `tenant_id` + the RLS policy above.
