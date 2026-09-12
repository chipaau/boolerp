# go-erp

Greenfield **Go rewrite** of the Laravel "Bool ERP" — a multi-tenant SaaS ERP for Maldivian
councils, ministries, health facilities, and private companies. **Dual deployment target:**
global SaaS *and* self-hostable (a ministry runs it on-prem with its own sub-tenants), often
operated by non-experts → bias every decision toward operational simplicity.

> **Status (2026-08-08): design stage — this repo is empty.** The decisions in the rules below
> are agreed; nothing is scaffolded yet. Do **not** create implementation files, migrations, or
> scaffolding without explicit confirmation from the user. See `.claude/rules/conventions.md`.

## Vision & operating principles

> This section outranks everything below it. Every feature, screen, copy change, and suggestion
> must be checked against it first. When a rule below (or an existing module design) pulls toward
> complexity, this section wins.
>
> Restored 2026-09-11 during docs consolidation — this section existed in the project's original
> CLAUDE.md (verified against the `erp.bak` archive) but was absent by the time of the `go-erp`
> GitLab snapshot and never carried into this repo. Text below is the original, unedited.

**Vision:** Running it should be the easy part.

**Mission:** Remove the steps, automate the busywork, and leave people the decisions.

SAP and Odoo optimize for organisations that already have process discipline; small teams drown
in their setup, modules, and mandatory steps. Bool optimizes for the small team first and scales
to large organisations. The lead message everywhere is **start free** and **AI-powered** —
Maldives localization is depth we ship, never the headline.

### Operating principles

1. **Small team is the default; scale is progressive.** Day one looks like a checklist, not a
   control panel. Institutional machinery (committees, value bands, hierarchies, approval chains)
   stays invisible until the org type or size demands it — org-type templates are the mechanism.
2. **Subtract before you build.** Every workflow step must justify itself. When regulation demands
   evidence, the system assembles it as a by-product of the work — the user never "does
   compliance" as a separate task.
3. **AI prepares, humans approve.** Data entry, document drafting, categorising, matching, filling
   forms from uploads — AI's job. Judgment and approval — the human's job. AI is a worker inside
   the flows, not a chatbot bolted on.
4. **No feature ships that makes the first week harder.** Onboarding, empty states, and defaults
   are product features; complexity added for the thousandth seat must cost the third seat
   nothing.
5. **Free to start.** Every app keeps a genuinely useful free tier; paid begins where the free
   tier is outgrown — per-seat, no contracts, no sales calls. Marketing and onboarding lead with
   start-free and AI, not geography.

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
