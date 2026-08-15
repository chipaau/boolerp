# go-erp

Greenfield **Go rewrite** of the Laravel "Bool ERP" — a multi-tenant SaaS ERP for Maldivian
councils, ministries, health facilities, and private companies. **Dual deployment target:**
global SaaS *and* self-hostable (a ministry runs it on-prem with its own sub-tenants), often
operated by non-experts → bias every decision toward operational simplicity.

> **Status (2026-08-08): design stage — this repo is empty.** The decisions in the rules below
> are agreed; nothing is scaffolded yet. Do **not** create implementation files, migrations, or
> scaffolding without explicit confirmation from the user. See `.claude/rules/conventions.md`.

## Stack (decided)

| Layer | Choice |
|---|---|
| Backend | Go · **Chi** router · **pgx** · **sqlc** · Goose migrations · `log/slog` |
| Tenancy | **pooled + Postgres RLS** · grain `tenant_id` · ltree + `tree_key` hierarchy · visible-set policy |
| Auth | **Ory Kratos** (identity + sessions) · Chi (stateless API) · **Cerbos** (authz) · Postgres |
| Jobs & cache | **Postgres-backed queue (river)** — transactional enqueue, runs via `WithTenant` · **Redis** (cache + rate-limit only) |
| Frontend | **React** · **TanStack Router** (Vite SPA) · **shadcn/ui** · SPA (no SSR) |
| Monorepo | single repo · pnpm workspaces · Turborepo · `apps/{app,admin,website,api}` + `packages/{ui,api-client}` |
| Repo | monorepo, single repo (Go API + TS frontend); Go↔TS types via OpenAPI-generated client |

Next.js is used **only** for the separate marketing website, never the app.

## Reference codebases (same parent `bool/`)

- `../workspace` — the live Laravel app: pooled tenancy (`spatie/laravel-multitenancy`) + `tenants.parent_id` ltree hierarchy. React/Next/shadcn. **This is how tenant parents should behave.**
- `../erp` — a later redesign: schema-per-tenant (its `docs/adr/0001-tenancy-model.md`) + explicit `tenant_visibility_grants`. Mine for its ADR format and platform-schema data model.

## Detailed rules

@.claude/rules/project-context.md
@.claude/rules/tenancy.md
@.claude/rules/auth.md
@.claude/rules/frontend.md
@.claude/rules/monorepo.md
@.claude/rules/conventions.md
@.claude/rules/testing.md
