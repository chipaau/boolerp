# Testing standard

**No use case reaches ✅ Implemented until it is fully tested, no code is committed until its tests
pass locally, and no PR goes up without 100% coverage on the code it touches.**

## Before every commit

- **Run the affected tests locally before `git commit` — never commit on a known-failing or
  unrun suite.** Local passing is a precondition for the commit, not something checked after.
- All test runs are **Docker-first** (see conventions.md) — never against host `go`/`node`:
  - API changes: `docker compose run --rm test` (Testcontainers-backed; real Postgres).
  - Frontend changes: that package's Vitest run, and its Playwright suite if behaviour changed,
    both inside the Node 24 container (host Node is below the engine floor).

## Before opening a PR

- **100% test coverage is required** for any code the PR touches — see the per-layer gates below.
  A PR that ships hand-written logic with no accompanying test, or that lowers coverage, doesn't go
  up for review.
- CI re-runs the same suites and coverage gates as a merge requirement; local green is necessary,
  not sufficient — CI is the authority.

## Layers

### API (`apps/api`, Go)

- **Unit** — Go stdlib `testing` + testify; table-driven; pure logic and edge cases.
- **Integration** — real Postgres via **Testcontainers** (`docker compose run --rm test`); each
  test runs in a transaction that **rolls back** (Laravel-`DatabaseTransactions` style). Exercises
  `WithTenant`/RLS, sqlc queries, Kratos (`whoami`) and Cerbos decisions against real services where
  feasible.
- **Coverage gate: 100%** (`go test -cover`/`-coverprofile`) on hand-written application code.
  Excluded — nothing meaningful to test: sqlc-generated code (`internal/db/sqlc/*.sql.go`,
  `models.go`, `querier.go`, `db.go`), `cmd/*/main.go` wiring, Goose migration files. An exclusion
  is a narrow, deliberate carve-out for generated/plumbing code, never a way to skip testing new
  hand-written logic — logic added inside an otherwise-excluded package still needs its own test.

### Frontend (`apps/app`, `apps/admin`, `apps/website`, `packages/ui`)

- **Component** — **Vitest + React Testing Library** (jsdom), run in the Node 24 container. Covers
  component rendering/logic and `lib/`/hook logic in isolation.
- **E2E** — **Playwright** against the running compose stack; drives `apps/app` and `apps/admin`
  through each user-facing use case (login, MFA, OIDC, provisioning, impersonation, …).
- **Coverage gate: 100%** on `components/**` and `lib/**` (Vitest `--coverage`). Route/page files
  are exempt from the component gate — they're thin composition, not logic — but every route still
  needs its own Playwright use-case coverage in exchange; a route with no E2E test is not covered.

## Traceability

- Every `UC-<AREA>-<n>` in the SRS maps to named tests; the component's checklist Definition-of-Done
  lists them. Coverage is checked **both ways**: 100% of lines/branches (above) and 100% of use
  cases actually exercised end-to-end — a fully-covered file behind an untested use case still
  fails review.

## Mandatory tenancy tests

- Every tenant-scoped feature has a **cross-tenant isolation test**: a second tenant's data must be
  invisible/unwritable — proving RLS + `WithTenant`. Ties to the RLS coverage guard (UC-FND-06).

## CI

- Every PR runs unit + integration (Testcontainers) + component (Vitest) + e2e (Playwright), with
  the coverage gates above enforced. Green — including 100% coverage — is required to merge.
