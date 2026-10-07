# Verification strategy

Status: in use. CI runs the checks below on every pull request (and weekly); the API's
coverage must stay at or above 90% (C119, raised by C143 and C163).

## Documentation and configuration

Check local links in current documentation and agent entry points, current scope,
decision statuses, and archive boundaries. Validate Compose syntax
(`docker compose config --quiet`); services are added deliberately, with their reason
(C08). Do not run application migrations or boot services for these checks.

## Domain and application

Test employee rules directly without infrastructure. Test application behavior
through its ports: access denial, required orchestration, error propagation,
audit participation, and commit outcomes. Avoid tests that only mirror trivial
implementation details.

## PostgreSQL integration

Use real PostgreSQL with the approved schema. Use an owner only for database setup;
execute application assertions as the restricted runtime role.

When relevant, verify cross-tenant reads/writes, missing scope, pooled connection
reuse, tenant-aware references, rollback, audit atomicity, concurrent uniqueness
or update conflicts, and migration behavior. If RLS is selected, test its actual
policies rather than assume a declared policy proves isolation.

## Providers, caching, and observability

Provider substitutes support application tests; real adapter integration requires
separate validation. Cover non-HTTP authorization/tenant enforcement.

For Redis caching, test tenant and permission separation, expiry, invalidation
after commit, rollback behavior, and outage fallback. Confirm tracing correlation
and sensitive-data handling without requiring an external exporter in every test.

## Architecture

Check dependency directions so core packages cannot import HTTP frameworks,
database drivers, generated SQL models, Redis clients, or provider implementations.
Generated persistence packages remain behind adapters.

Do not impose redundant unit/integration/browser suites on every low-level operation.
The one coverage rule is the API's 90% threshold (C119, C143, C163), measured, never assumed.

## Telemetry, tracing, and audit in tests (C110)

Test runs export no telemetry. The API's and BFFs' traces and metrics are off unless
`OTEL_TRACES_EXPORTER` / `OTEL_METRICS_EXPORTER` are set: unit and feature tests never set
them, and the end-to-end CI job sets both to `none`. Kratos and Hydra never send Ory their
anonymous usage reports (`SQA_OPT_OUT`, set in Compose for development and tests alike), and
their own tracing is not configured.

Audit stays on in tests. It is a business record written in the same transaction as the
change it describes (step 9), so tests must exercise it: an audited change without its record,
or a failed audit write that does not roll the change back, is a defect a test has to catch.

## Frontend tests (C175, C185)

- `@workspace/api`'s unit tests stub `fetch`; `@workspace/ui`'s components test with jsdom.
- The admin console's tests (`pnpm --filter admin test`) render the real route tree with the
  console's own QueryClient (the error policy included) and fake the network with MSW 3, which
  fails any request without a handler (`onUnhandledFrame: 'error'`). Never mock a feature's
  modules: schemas and error handling must run. Helpers: `src/test/server.ts` (the MSW server,
  answering `/api/auth/me`) and `src/test/render.tsx` (`renderRoute(url)`).

## End-to-end tests (C109)

Playwright tests run in a real browser against the running Compose stack, through Traefik,
covering what is integrated: sign-in through each app's BFF, Hydra, and the login service;
the API through the BFF; sign-out everywhere; and each app package's own journeys.

- **`e2e/`** is the harness and the cross-cutting suite: `playwright.config.ts`, `run.sh`,
  `tests/helpers.ts` (URLs, the account, `openSignedIn`, and `test`/`expect` for app specs),
  and the `platform` specs (`sign-in`, `sign-out`).
- **The account** is `e2e@bool.test` with the public development password, an active member
  of male-city (the suite's workspace). `docker compose run --rm seed` creates it, in `dev`
  only (C161), so the stack must be seeded before the suite runs; CI seeds it.
- **App packages keep their own journeys** in `packages/app-<slug>/e2e/*.spec.ts`, importing
  `test` and `expect` from the harness's helpers. The config runs a project per app in the
  edition that has an `e2e/` folder (`EDITION`, default `full`, C107).

Run it with the stack up:

```sh
e2e/run.sh                          # platform + the full edition's apps
e2e/run.sh --project control-centre # one app
EDITION=full e2e/run.sh
```

`run.sh` runs Playwright's image on the `proxy` network only (the `*.bool.test` hosts mapped
to Traefik), with its dependencies in the `erp-e2e-node-modules` volume. The suite uses one worker and one account, and runs in CI
(C109). Before the tests, `e2e/warm.sh` opens the pages the suite reaches first, so the
development servers have compiled them before a test is timed. App journeys (the app
projects) start signed in: a `signed-in` setup project signs in once and saves the browser
state, so they do not sign in before every test; the platform tests (sign-in, sign-out)
still use fresh browsers (C127).

See [employee scope](hrms/employees.md) and [execution](platform/execution.md).

## Test tooling

Tests use Go's `testing` package with `stretchr/testify` assertions (C28). Use
`require` when the test cannot continue after a failure (it stops the test, like
`t.Fatal`) and `assert` for independent checks (it records the failure and
continues, like `t.Error`). Do not use testify's `mock` or `suite` packages
without a separate decision.

Tests run with the race detector (`go test -race`) in CI (C32). It needs cgo, so the
Go dev image (`docker/go.Dockerfile`) is the Debian-based `golang:1.27`, not Alpine.
Tests that share state between goroutines, such as a log buffer written by a server
goroutine, must synchronize it.

## Current CI boundary

CI runs **only on pull requests** (and manually), not on merges (C78). A first job
detects which parts changed; API jobs run only when the API changed, frontend jobs only
when the frontend changed, and a change to the workflow runs everything. Skipped jobs
count as successful.

| Job | Runs | Needs |
| --- | --- | --- |
| API lint | `golangci-lint fmt --diff` (formatting) and `golangci-lint run` (C75) | nothing |
| API feature tests and coverage | `run-feature-tests.sh`: `cmd/migrate` once, then the whole suite, unit and feature tests, `go test -race -tags feature -coverpkg=./... -coverprofile=cover.out ./...` (C77, C79, C143); then go-test-coverage fails the job below the threshold in `apps/api/.testcoverage.yml` (C119) | PostgreSQL (roles script), Redis, and Cerbos with the edition's policies (`start-cerbos.sh`) |
| API vulnerabilities | `govulncheck` (C113): known vulnerabilities in Go code the API calls | nothing |
| API image | builds the production image, runs its `migrate`, and scans it with Grype (C113) | PostgreSQL |
| workspace / admin / identity / website | frontend typecheck (where the app has one) and build | nothing |
| Frontend lint and tests | `pnpm -r run lint` and the vitest suites of every app and package that has them (C127) | nothing |
| Frontend dependency audit | `pnpm audit --prod --audit-level high` (C113) | nothing |
| BFF images | builds the workspace and admin release images and scans them with Grype (C113) | nothing |
| Secret scan | Gitleaks over the whole history, every pull request (C113) | nothing |
| End-to-end tests | the Compose stack behind a throwaway Traefik, `e2e/warm.sh`, then `e2e/run.sh` (C109, C127) | the stack |

Every job also runs weekly (Mondays 03:00 UTC) and on a manual run, whatever changed, so the
scanners report new vulnerabilities in code and images no pull request touched (C127). The
API's unit tests run once, inside the feature-test job, with the race detector.

Merging a failing pull request is not blocked: required status checks need a paid GitHub
plan for private repositories. Check that CI passed before merging. Dependabot (C76)
update pull requests go through the same jobs.

### Coverage (C119)

The API's total statement coverage, from the unit and feature tests together, must stay
at or above the threshold in `apps/api/.testcoverage.yml` (90%); every test counts towards
the code it runs, in any package (`go test -coverpkg=./...`, C143); the API feature-test
job fails otherwise. The process entry points (`cmd/*`) are excluded: they only read
settings, wire the build, and start a process, and the end-to-end suite runs them,
which Go's coverage cannot see. Everything they call is counted. When coverage rises,
raise the threshold in the same pull request; never lower it to make a check pass. The
check uses [go-test-coverage](https://github.com/vladopajic/go-test-coverage) (GPL-3.0,
run as a tool in CI, never imported). To measure locally, run the feature tests as CI
does (above) and then:

```sh
docker run --rm -v "$PWD/apps/api:/src" -w /src golang:1.27 \
  go run github.com/vladopajic/go-test-coverage/v2@v2.19.0 --config=.testcoverage.yml
```

### Endpoint tests (C156)

An endpoint test calls an API route through the real router and middleware, against the
real PostgreSQL (the test's rolled-back transaction as the runtime role), like Laravel's
feature tests:

- **Authentication is faked**, like `actingAs`: the test swaps the token check for known
  test tokens (`fakeTokens` in `identity/auth`), never real Hydra tokens.
- **Authorization is faked**: an `authorization.Authorizer` that allows or denies as the
  test states, and notes its decisions (`authorization.NoteDecision`) so the
  record-or-deny backstop sees them.
- **Every other outside service is faked**: Kratos, Hydra, Cerbos, mail, object storage
  (`httptest` servers or fakes behind the module's port).
- **The database state is asserted after every write**: `testdb.AssertHas` after a create
  or update (the row with the expected values), `testdb.AssertMissing` after a delete or
  when nothing may be written, `testdb.Count` for duplicates.

Only **adapter tests** talk to a real outside service, to prove the integration itself:
`authorization/cerbos_feature_test.go` asks the real Cerbos with the edition's policies.
Example: `identity/auth/me_feature_test.go`.

### Authorization policies (C151)

Each module keeps its Cerbos policies in `policies/`, with a `_test.yaml` suite beside each
policy and JSON Schemas for the attributes it uses under `policies/_schemas/`. CI's
`api-policies` job assembles the edition's policies (`cmd/policies`) and runs
`cerbos compile` on them, which validates every policy and runs every suite. A Go test
(`TestEveryPolicyHasTestsAndSchemas`) fails when a policy has no suite beside it, declares
no principal or resource schema, or references a schema no module provides. Locally:

```sh
docker compose run --rm policies
docker run --rm -v erp_cerbos-policies:/policies:ro ghcr.io/cerbos/cerbos:0.56.0 compile /policies
```

### Supply chain (C113)

- **Scans:** a finding fails its job. Grype fails on high or critical vulnerabilities that
  have a fix (`--fail-on high --only-fixed`); `pnpm audit` on high or critical ones in
  production dependencies; `govulncheck` on any vulnerability the code calls (one only in
  a required module, never called, is reported without failing). Gitleaks uses
  `.gitleaks.toml`: its default rules, with `docker/secrets/dev/` allowed (public by
  design, C80). To clear a finding, update the dependency; if no fix applies, record the
  exception and its reason in the [security review](security/README.md) before ignoring it
  in the tool's own configuration.
- **Pinning:** Actions are pinned to commit SHAs (with the version in a comment) and images
  to digests (`image:tag@sha256:…`), because a tag can be moved to other code. Dependabot
  updates the Actions and the Dockerfiles' base images, digest included. Images named in
  `ci.yml`'s `env`, `.github/scripts/start-postgres.sh`, and `e2e/run.sh` are updated by
  hand: replace the tag and digest together (`docker buildx imagetools inspect <image:tag>`
  prints the digest). The Dockerfiles install a pinned `corepack`.
- **Workflow token:** every checkout sets `persist-credentials: false`, so the token is not
  left in the repository's Git configuration for later steps.
- **Frontend versions:** dependencies use version ranges (`^`), never `latest`; installs
  use the lockfile (`--frozen-lockfile`). The e2e harness installs `@playwright/test` with
  npm and no lockfile, which is still exact: it and its two dependencies pin exact versions.

### Unit and feature tests (C77)

- **Unit tests** need no external services: configuration, handlers, validation, logging,
  problem responses, and anything using fakes or `httptest`.
- **Feature tests** run against real PostgreSQL, Redis, and Cerbos (C155): the pool, migrations, role
  privileges, database and cache tracing, and later full HTTP requests through the app
  with a database (like Laravel's feature tests). They live in `*_feature_test.go` files
  that start with `//go:build feature`, and their names start with `TestFeature`. They
  fail, never skip, when their services are not configured.

### Feature test databases (C79)

The migrations run **once per test run**, not per test: `run-feature-tests.sh` applies
them to the suite database (`erp`) with the real `cmd/migrate`, then starts `go test`.
Each test then works inside a transaction that is rolled back when it ends, so nothing
it writes survives and tests cannot see each other's data:

```go
func TestFeatureSomething(t *testing.T) {
	tx := testdb.Tx(t) // runtime role (erp_app); rolled back at the end of the test
	// pass tx to the code under test
}
```

`testdb.Tx` connects as the restricted runtime role, so a test gets the API's privileges,
not the owner's. `testdb.OwnerTx` is the same as the migration role, which owns the
tables: for rows the runtime role may not write, and for constraints.

**Tests never depend on data in the database (C135).** The suite database has only the
schema: no migration inserts rows, and neither `cmd/seed` nor `cmd/deploy` runs before
the tests. Each test creates the rows it needs inside its own transaction, with values
that cannot clash with real data, such as ISO's user-assigned country codes (`XA`,
`XAA`). Seed files are tested the same way: the seeder runs inside `testdb.OwnerTx` with
a small list, and a unit test checks the real file.

Test packages run at the same time against the same database, so (C139):
- **Each package uses its own test values** (for example countries `XA`/`XB` in
  `reference`, `XT`/`XU` in `tenancy`): two uncommitted inserts of the same key wait on
  each other and can deadlock.
- **No `ALTER TABLE` on a table other packages' tests use:** its lock blocks them. Check
  a policy's definition in `pg_policies` instead, and test `updated_at` triggers by
  inserting a backdated row. Forcing row-level security to test policies as the owner is
  fine only on a table one package alone uses (`tenants`).
- **A test that migrates the platform database removes everything it created**, so the
  suite can run repeatedly against the same server. Application code therefore accepts either the pool or a transaction
(step 6). `testdb.Settings(t, role)` gives connection settings for the suite database.

Tests that cannot run inside a rolled-back transaction, such as the migrator itself,
role privileges, and concurrent migrations, use the second database `erp_platform`
through `testdb.PlatformSettings(t, role)`. It has the same roles and grants
(`database-setup.psql`) but is never migrated, and those tests drop what they create.

Run them locally:

```sh
# Lint and formatting
docker run --rm -v "$PWD/apps/api:/src" -w /src golangci/golangci-lint:v2.14.0 \
  sh -c 'golangci-lint fmt --diff ./... && golangci-lint run ./...'

# Unit tests (no services)
docker run --rm -v "$PWD/apps/api:/src" -w /src golang:1.27 go test -race ./...

# Feature tests: a throwaway PostgreSQL (with erp_platform), Redis, and Cerbos (loaded with
# the edition's policies) on the "ci" network
.github/scripts/start-postgres.sh
docker run -d --name redis --network ci redis:8-alpine
.github/scripts/start-cerbos.sh
.github/scripts/run-feature-tests.sh
docker rm -f postgres redis cerbos && docker network rm ci
```

Never point feature tests at a database with data you want to keep.
