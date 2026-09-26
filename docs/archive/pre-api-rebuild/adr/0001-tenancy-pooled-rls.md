# ADR 0001 — Tenancy model: pooled + Postgres RLS

| | |
|---|---|
| Status | **Accepted** (2026-08-13) |
| Deciders | Product owner + engineering |
| Supersedes | Schema-per-tenant (bridge) — see [`history/0001-schema-per-tenant.md`](history/0001-schema-per-tenant.md) |

> **Note on numbering:** the prior GitLab-hosted redesign of this project also had an "ADR 0001,"
> deciding schema-per-tenant. This repo's ADR sequence starts fresh at migration to GitHub; that
> earlier document is preserved under `history/` for its research and reasoning, not as part of
> this sequence.

## Context

Bool ERP serves Maldivian councils, health facilities, ministries, and private companies, and ships
as **both** global SaaS and a self-hostable artifact a ministry runs for itself and its sub-tenants.
The tenancy storage model is the most consequential architecture decision in the system — it drives
isolation guarantees, migrations, cross-tenant aggregation, backup/restore, and self-host
operational complexity. Three candidate models (AWS SaaS terminology), same as considered previously:

1. **Pool** — shared tables + `tenant_id` column, Postgres Row-Level Security. *(Chosen.)*
2. **Bridge** — one PostgreSQL schema per tenant on a shared cluster, plus a shared `platform`
   schema. *(Previously chosen — [see history](history/0001-schema-per-tenant.md); reversed here.)*
3. **Silo** — database/instance per tenant.

## Why the reversal

The bridge decision was sound for the concerns it optimized for (isolation-by-construction,
per-tenant `pg_dump`/restore, government-posture blast-radius). Three things outweigh it now:

1. **Live parent→child aggregation is a product requirement, and pooled is where it's native.**
   `../workspace` (the live Laravel app) already does hierarchical ministry-oversight aggregation
   over pooled tables + a `parent_id`/ltree hierarchy — this is the proven shape for the "central
   tenant management" differentiator (a ministry seeing aggregate child-tenant data). Under
   schema-per-tenant, the same aggregation means cross-schema queries through platform bridge
   tables — real, but structurally awkward for something this central to the product.
2. **`set_config(..., true)` (transaction-local) works cleanly through PgBouncer; schema-per-tenant's
   `search_path` switching does not.** A connection pooler multiplexes physical connections across
   requests; per-request `search_path` mutation on a pooled connection is a well-known footgun
   (a mis-ordered reset leaks one tenant's `search_path` into another's request). RLS's
   `set_config(current_tenant, ..., true)` is scoped to the transaction and never leaks across the
   pool — makes running behind PgBouncer (needed at any real connection-count scale) far safer.
3. **Self-host simplicity: one database, one migration path.** The dual-deployment target (SaaS +
   a ministry self-hosting on its own box, operated by non-experts) means *fewer moving parts wins*.
   Schema-per-tenant requires fleet-migration tooling (a migrator that runs a change across N
   tenant schemas with tracking/resume) even for a self-hosted install with one tenant + a handful
   of sub-tenants. Pooled + RLS means the self-host artifact runs ordinary Goose migrations against
   one schema — no fleet runner to build, operate, or explain to a ministry's IT staff.

The bridge ADR's tenant-count analysis (hundreds, not tens of thousands) still holds and was never
the deciding factor either way — pooled + RLS is not chosen here because of scale, it's chosen
because live aggregation + pooler compatibility + self-host simplicity matter more than
isolation-by-construction for this product.

## Decision

**Pooled tables + Postgres Row-Level Security**, grain `tenant_id` only (no `company_id` — each
legal entity is its own tenant in the hierarchy; multi-entity consolidation = parent-tenant
aggregation, the same mechanism as ministry oversight):

- Every business table carries `tenant_id uuid NOT NULL DEFAULT current_setting('app.current_tenant')::uuid`.
- `WithTenant(ctx, tenantID, fn)` opens a transaction, sets `app.current_tenant` (and, only when a
  parent enters aggregation mode, `app.visible_tenants`) via `set_config(..., true)` — **LOCAL**,
  never leaks across the pool — then runs `fn`. All HTTP handlers **and background jobs** go through it.
- One RLS policy unifies isolation + parent visibility: reads see the visible set (self ∪
  authorized descendants, only in aggregation mode); writes are pinned to the active tenant.
  Visibility resolves from the tenant's ltree subtree ∩ `tenant_visibility_grants` — never implicit.
- Hard requirements: the app connects as a **non-owner** Postgres role; `FORCE ROW LEVEL SECURITY`
  on every tenant table; a CI test that fails if any tenant-scoped table lacks a policy; composite
  FKs including `tenant_id` make cross-tenant references impossible at the DB level.
- Platform/control-plane tables (`tenants`, `users`, `tenant_users`, `tenant_visibility_grants`,
  `roles`, …) stay cross-tenant by nature (tenant switching, membership resolution) and are **not**
  under the tenant RLS regime — same distinction the bridge ADR drew with its `platform` schema.
- Deployment still follows tenant subtrees via a `connection_key`-style route (SaaS regional
  cluster / on-prem instance / promoted heavy tenant) — the bridge ADR's per-tenant physical
  escape hatch survives, just expressed as a routing key rather than a schema boundary.

Full mechanics: [`.claude/rules/tenancy.md`](../../.claude/rules/tenancy.md).

## Consequences

- **Isolation is now enforced by RLS policy + a CI guard, not by the absence of a shared table.**
  A module forgetting to scope a query can no longer be caught by "the table doesn't exist in this
  schema" — it's caught by `FORCE RLS` + the policy + the CI test that every tenant table has one.
  This is a real trade against the bridge model's isolation-by-construction; the compensating
  controls (FORCE RLS, non-owner role, CI guard, composite FKs) exist specifically to close that gap.
- Per-tenant backup/restore and Auditor-General-style per-tenant export (`pg_dump -n t_slug` under
  bridge) become row-filtered exports instead of schema-level ones — operationally different, not
  necessarily harder, but a real change to how offboarding/export tooling works.
- No fleet-migration tooling is needed; ordinary Goose migrations apply once, to one schema, for
  every deployment shape (SaaS cluster or self-host box).
- Cross-tenant analytics can eventually run ad-hoc SQL directly against the pooled tables if ever
  needed — the bridge model's explicit-bridge-tables discipline is no longer structurally forced,
  though `tenant_visibility_grants` + the visible-set policy remain the intended path for anything
  that isn't a platform-level aggregate.
- If per-tenant physical isolation or data residency ever becomes a hard requirement (e.g. a
  government client demanding its own physical database), that reopens this ADR — likely as a
  per-tenant `connection_key` promotion rather than a wholesale reversal back to bridge.

### Deferred: real financial consolidation across tenants (named trigger)

Each legal entity is one tenant (Decision 2). For the current customer base (councils, ministries,
health facilities), a parent tenant "consolidating" a child's numbers is a **read-side rollup**
(`tenant_visibility_grants` + aggregate reporting) — safe with plain addition because the only
inter-tenant flow so far (inter-tenant stock requests) is **notional, no invoice**: nothing is
booked as revenue anywhere, so there is nothing to double-count.

This stops being sufficient the moment a customer needs **real consolidated financial statements**
across two tenants that actually trade with each other for money — that requires intercompany
**elimination** (netting out the internal transaction so it isn't counted twice), and potentially
non-controlling-interest math (partial ownership) and currency translation. None of that is
modelled here, deliberately — see [`docs/overview.md` vision principles](../../CLAUDE.md) (small
team is the default; institutional machinery stays invisible until it's demanded).

**Named trigger:** a paying customer needs statutory consolidated financial statements across two
tenants with real intercompany transactions (real invoices, ownership percentages, and/or
multi-currency translation) — not just an operational rollup. **When that fires:** model
consolidation as an **additive layer** (e.g. an elimination-rules mechanism alongside
`tenant_visibility_grants`) — never retrofit `company_id` onto the base `tenant_id` grain or onto
existing financial tables. This keeps today's zero-complexity cost for every customer who doesn't
need it, while keeping the addition, when it comes, bounded and non-breaking.

## Document history

| Date | Change |
|---|---|
| 2026-08-13 | Decision made (recorded in `.claude/rules/tenancy.md`/`project-context.md`); this ADR written retroactively during docs consolidation to close the gap between the rules citing "ADR 0001" and no such document existing |
