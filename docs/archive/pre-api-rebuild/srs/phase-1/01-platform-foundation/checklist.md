# 01 — Platform Foundation — Confirmation Checklist

**Status:** 🟡 Partially Implemented (2026-09-12) &nbsp;·&nbsp; The substrate every component sits on.
`WithTenant`, the RLS coverage guard, and the tenant-resolution middleware are built and tested
(`internal/tenancy`) — but the guard has nothing real to enforce yet (no business tables exist), and
the middleware isn't mounted on any route (no tenant-scoped business endpoint exists to need it).
**Not built:** the interactive first-run setup wizard (UC-FND-02) and `GET /api/v1/bootstrap`
(UC-FND-04) — `cmd/provision-dev` is dev-only tooling, not the first-run wizard.

## Scope
- **In:** Chi app skeleton + `main.go` wiring; config loading; DB pool (pgx) + `WithTenant` RLS
  wrapper; RLS policy conventions + CI policy test; `/healthz`; `GET /api/v1/bootstrap`; reference-data
  seeding (countries, currencies, atolls/islands/wards); **self-host first-run bootstrap**.
- **Out:** business logic; specific auth/tenant flows (their own components).

## Candidate use cases
- UC-FND-01 — App boots, connects DB as non-owner role, verifies RLS is enforced
- UC-FND-02 — `WithTenant(ctx, id)` sets `app.current_tenant` LOCAL; queries auto-scoped
- UC-FND-03 — `GET /bootstrap` returns user + active tenant + memberships + caps + modules
- UC-FND-04 — Reference data seeded on first migrate
- UC-FND-05 — **Self-host first-run:** seed the internal/operator tenant + first admin identity
- UC-FND-08 — **Docker/compose unit:** `compose up` brings up postgres · kratos · cerbos · api+SPAs

## ⚠️ Likely-missing / confirm
- First-admin bootstrap mechanism: CLI command? seeded recovery link? env-provided owner email?
- CI test that fails if any tenant-scoped table lacks an RLS policy (hard requirement)
- Config strategy (env vs file) for the dual SaaS/self-host target

## Open questions
- [x] First admin created via **interactive web setup** on first run (confirmed 2026-08-13).
- [x] Internal/operator tenant: **created by first-run setup** (not blind auto-seed); ties to 05.
- [x] Config: **env-first** + optional file, self-host defaults.
- [x] RLS coverage guard: **startup + CI** (hard requirement).
- [ ] `/bootstrap` payload shape (vs frontend.md) · reference-data source · first-run Kratos/Cerbos scope.

## Data-model touchpoints
- Reference tables (group B); no new business tables.

## Sign-off
- [x] Scope confirmed &nbsp; [x] Open questions resolved &nbsp; [x] Use-case inventory complete
- [x] **Data model confirmed** — 10 tables, table-by-table, in `docs/data-model/DB-FOUNDATION.md` (2026-08-13)
- [~] **Partially implemented** (2026-09-12): `internal/tenancy.WithTenant`, `CheckRLSCoverage`
  (wired into `cmd/api` startup), `Middleware.RequireTenant` — all tested (`internal/tenancy/*_test.go`).
  Remaining: first-run setup wizard, `GET /api/v1/bootstrap`, mounting `RequireTenant` on a real
  tenant-scoped route once one exists.
