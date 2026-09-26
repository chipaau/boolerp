# 01 — Platform Foundation — SRS

**Status:** 🟡 In Review &nbsp;·&nbsp; The substrate: one Go binary (Chi) serving the API + embedded
SPAs, the RLS tenancy plumbing, health, `/bootstrap`, and first-run setup.

## Confirmed decisions (2026-08-13)
- **First admin/tenant:** created by the **interactive first-run web setup** — it creates the
  **internal/operator tenant** + the first operator identity (via Kratos admin API), then locks itself.
- **Config:** **env-first (12-factor)** + optional file; documented defaults for self-host.
- **Migrations:** **Goose**; app schema migrations are separate from Kratos'; **DDL runs over a direct
  (non-PgBouncer) owner connection** (app traffic uses the pooler — avoids search_path/plan-cache issues).
  The app connects at runtime as a **non-owner** role.
- **RLS:** `FORCE ROW LEVEL SECURITY` + the visible-set policy + `tenant_id` column default; a
  **startup + CI check** fails if any tenant-scoped table lacks a policy.

## Functional requirements
| ID | Requirement |
|---|---|
| FR-FND-01 | One Go binary serves `/api/*` (Chi), the embedded `apps/app` + `apps/admin` SPAs, and health. |
| FR-FND-02 | Config via env (12-factor) + optional file; sane self-host defaults. |
| FR-FND-03 | pgx pool; runtime connects as a **non-owner** role; migrations/DDL use a separate owner + direct connection. |
| FR-FND-04 | `WithTenant(ctx, tenantID, fn)` opens a tx and `set_config`s `app.current_tenant` (+ `app.visible_tenants`) **LOCAL**; every handler and background job goes through it. |
| FR-FND-05 | RLS conventions enforced repo-wide + a **startup/CI guard** that fails if any tenant-scoped table lacks `FORCE RLS` + a policy. |
| FR-FND-06 | Goose migrations; `migrate` command / on-deploy; app migrations independent of Kratos migrations. |
| FR-FND-07 | Idempotent **reference-data seeding** (currencies, countries, atolls/islands/wards). |
| FR-FND-08 | `GET /api/v1/bootstrap` — auth-gated context (user, active tenant, memberships, capabilities, enabled modules). |
| FR-FND-09 | `/healthz` (liveness) + `/readyz` (readiness gates on DB, Kratos, Cerbos reachability). |
| FR-FND-10 | **First-run web setup**: when uninitialized (no internal tenant), serve a setup wizard to create the internal/operator tenant + first operator; **lock after completion**. |
| FR-FND-11 | Request-ID middleware, structured logging + graceful shutdown bootstrap (detailed in 07). |
| FR-FND-12 | **Docker / compose unit** (`docker/`): postgres (app + kratos DBs) · kratos (+ migrate) · cerbos · api (embeds both SPAs). One `compose up`; dev + prod overlays; Kratos admin + Cerbos internal-only. |

## Non-functional
- Single self-host artifact (binary embeds both SPA `dist`s).
- Readiness reflects real dependency health for `compose`/orchestration.
- Dependencies wired explicitly in `main.go` — no DI framework (see conventions).

## Open (resolve before 🟢)
- [ ] Exact `/bootstrap` payload shape — confirm against `frontend.md`.
- [ ] Reference datasets (atolls/islands/wards) — source + version.
- [ ] Does first-run touch Kratos/Cerbos config, or only app-level state (assuming `compose` already up)?

## Use cases
See [`use-cases.md`](use-cases.md) — UC-FND-01 … UC-FND-07.
