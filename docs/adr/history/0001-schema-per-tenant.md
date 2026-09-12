> **Historical record only.** This decision was reversed 2026-08-13 — **pooled + Postgres RLS**
> was chosen instead; see [`../0001-tenancy-pooled-rls.md`](../0001-tenancy-pooled-rls.md) for the
> reversal and its reasoning. Kept here verbatim (from the prior GitLab-hosted redesign of this
> project) because its research and the "internal tenant" / guardrails thinking below informed the
> reversal and are still referenced elsewhere in the docs. This file uses that project's original
> ADR numbering (0001) — it is **not** part of this repo's current ADR sequence.

# ADR 0001 — Tenancy model: schema-per-tenant on a shared cluster

| | |
|---|---|
| Status | ~~Accepted~~ **Superseded** (2026-07-15 → 2026-08-13) |
| Deciders | Product owner + engineering |
| Supersedes | — |
| Superseded by | `0001-tenancy-pooled-rls.md` (this repo) |

## Context

Bool ERP serves Maldivian councils, health facilities, ministries, and
private companies. The tenancy storage model is the most consequential
architecture decision in the system: it drives isolation guarantees,
migrations, backup/restore, analytics, and operating cost. Three candidate
models (AWS SaaS terminology):

1. **Pool** — shared tables + `tenant_id` column, optionally PostgreSQL RLS.
2. **Bridge** — one PostgreSQL **schema per tenant** on a shared cluster,
   plus a shared `platform` schema. *(Chosen.)*
3. **Silo** — database/instance per tenant.

## Research summary (July 2026)

- Industry default for **high-tenant-count self-serve SaaS** is pooled +
  RLS ([PlanetScale](https://planetscale.com/blog/approaches-to-tenancy-in-postgres),
  [Crunchy Data](https://www.crunchydata.com/blog/designing-your-postgres-database-for-multi-tenancy)).
  Schema-per-tenant costs are real and quantified: pg_catalog bloat
  (~1–2 KB/table in `pg_class` + `pg_attribute` + index entries), slower
  planning/connection startup, N-schema migration loops, slow `pg_dump`.
- The commonly cited **crossover where those costs dominate is
  ~1,000–5,000 tenants**; even Citus — whose product is pooled sharding —
  [recommends schema-based sharding up to "several thousand tenants"](https://docs.citusdata.com/en/stable/use_cases/multi_tenant.html).
- For **regulated/compliance-leaning products**, AWS guidance steers to
  bridge/silo ([SaaS Lens](https://docs.aws.amazon.com/wellarchitected/latest/saas-lens/silo-pool-and-bridge-models.html),
  [tenant-isolation whitepaper](https://docs.aws.amazon.com/whitepapers/latest/saas-tenant-isolation-strategies/the-bridge-model.html));
  per-tenant backup/restore in pooled models is
  ["significantly more complex"](https://aws.amazon.com/blogs/database/managed-database-backup-and-recovery-in-a-multi-tenant-saas-application/).

## Decision drivers specific to Bool

1. **Tenant count ceiling is hundreds, not tens of thousands** (~210
   councils, ~200 health facilities, ~20 ministries + private growth;
   realistic 400–800, optimistic ~2,000) — at/below the crossover's lower
   bound. Tenants are operator-provisioned, never self-serve signups.
2. **Government posture demands per-tenant lifecycle operations**:
   Auditor-General/offboarding exports (`pg_dump -n t_slug`), single-tenant
   restore after data accidents, moving a heavy tenant to a dedicated
   instance (`connection_key`) — all row-carving projects under pool.
3. **Isolation by construction**: tenant tables carry no `tenant_id`;
   module code cannot forget a filter that does not exist. For an ERP whose
   product thesis is institutional trust, blast-radius wins over density.
4. **Cross-tenant needs are explicit and bounded**: inter-tenant stock,
   ministry aggregates, and catalog adoption run through platform-schema
   bridge tables + materialized summaries — the pooled model's main
   advantage (ad-hoc cross-tenant SQL) is deliberately not a requirement.

## Decision

**Schema-per-tenant (bridge) on a shared PostgreSQL cluster**, with:

- a shared **`platform` schema** for the control plane (tenants, users,
  memberships, grants, audit, outbox, bridge tables);
- **identity pooled by design**: one user account spans tenants
  (memberships per tenant; employee records are per-tenant rows linked to
  the platform user). Do not "fix" users into tenant schemas;
- the **internal tenant** as the operator model (see below);
- **`connection_key`** as the first-class bridge→silo escape hatch for
  heavy tenants;
- a **pooled analytical read model (warehouse) fed by the outbox** as the
  designated Phase-2+ answer for network-scale analytics — never ad-hoc
  cross-schema OLTP queries.

### Internal tenant (operator model)

Exactly one tenant carries `is_internal = true` (reserved slug, seeded at
bootstrap, undeletable). Bool staff are ordinary users with memberships and
roles **in the internal tenant** — one uniform users/roles/capability
mechanism for the entire system, and Bool dogfoods its own ERP. The single
deliberate asymmetry: **only `platform:*` capabilities held via
internal-tenant roles have platform-wide effect** (Cerbos policies require
the `is_internal_member` principal attribute); domain capabilities in the
internal tenant stay scoped to it. Guardrails: four-eyes on internal-tenant
role changes; operator access to tenant *data* (vs lifecycle/config)
requires explicit **time-boxed, audited support-access grants**; admin-app
entry requires active internal membership.

> This "internal tenant" concept **survived the reversal unchanged** — it's
> independent of the storage model and is implemented in the current schema
> (`tenants.is_internal`) and `.claude/rules/auth.md`/`tenancy.md`.

### Partitioning amendment

The original "partition high-volume tables by tenant + month from day 1"
rule multiplies catalog growth under schema-per-tenant (≈ tens of
thousands of extra tables/year at fleet scale) while most tenants are far
too small to benefit. Amended:

- **Platform-schema shared tables** (audit log, outbox — they carry
  `tenant_id`) partition by month from day 1.
- **Tenant-schema tables are plain indexed tables by default**;
  partitioning is introduced per-tenant only when a tenant's volume
  demands it (such tenants are also the `connection_key` candidates).

### Guardrails & budgets

- Soft cap ≈ **2,000 tenants per shared cluster**; revisit this ADR before
  exceeding it.
- Monitor from day 1: pg_catalog size, total relation count, per-tenant
  table count, fleet-migration wall time (parallelize the fleet runner).
- Keep tenant schemas lean: custom fields stay JSONB (never per-tenant
  tables); no per-tenant code forks.

## Consequences

- Fleet migration tooling is mandatory infrastructure (A1 shipped the
  single-schema migrator; A2 generalizes with ledger/resume).
- Backup strategy: cluster-level PITR + per-tenant-schema `pg_dump` jobs.
- Cross-tenant features must be designed through platform bridges — this
  is a feature, not a limitation.
- If Bool ever pivots to high-volume self-serve tenancy (≫ thousands of
  small tenants), pooled+RLS becomes the right answer — that would be a new
  ADR and a major migration.

  **(2026-08-13 update: that reversal happened — see `0001-tenancy-pooled-rls.md` — though the
  trigger was live-aggregation/PgBouncer/self-host simplicity, not tenant-count growth.)**

## Sources

[PlanetScale — Approaches to tenancy in Postgres](https://planetscale.com/blog/approaches-to-tenancy-in-postgres) ·
[Crunchy Data — Designing Postgres for multi-tenancy](https://www.crunchydata.com/blog/designing-your-postgres-database-for-multi-tenancy) ·
[Citus — Multi-tenant applications](https://docs.citusdata.com/en/stable/use_cases/multi_tenant.html) ·
[AWS SaaS Lens — Silo, Pool, Bridge](https://docs.aws.amazon.com/wellarchitected/latest/saas-lens/silo-pool-and-bridge-models.html) ·
[AWS — The bridge model](https://docs.aws.amazon.com/whitepapers/latest/saas-tenant-isolation-strategies/the-bridge-model.html) ·
[AWS — Multi-tenant backup & recovery](https://aws.amazon.com/blogs/database/managed-database-backup-and-recovery-in-a-multi-tenant-saas-application/) ·
[AWS — RLS tenant isolation](https://aws.amazon.com/blogs/database/multi-tenant-data-isolation-with-postgresql-row-level-security/) ·
[Table-per-tenant vs shared-table tradeoffs](https://gauravsarma1992.medium.com/table-per-tenant-vs-shared-table-the-multi-tenancy-tradeoff-in-postgres-f2ee80395505) ·
[SaaS Postgres multi-tenancy patterns](https://www.adiagr.com/blog/07-saas-postgres-multitenancy-patterns/)
