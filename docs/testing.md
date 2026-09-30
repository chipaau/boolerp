# Verification strategy

Status: proposed acceptance strategy for the new API. No coverage or passing
application-test claim is inherited from the previous implementation.

## Documentation and configuration

Check local links in current documentation and agent entry points, current scope,
decision statuses, and archive boundaries. Validate Compose syntax and ensure its
service set remains api, app, postgres, and redis. Do not run application migrations
or boot services for these checks.

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

## Architecture and deferred integration

Check dependency directions so core packages cannot import HTTP frameworks,
database drivers, generated SQL models, Redis clients, or provider implementations.
Generated persistence packages remain behind adapters.

Add browser tests when frontend integration is authorized. Do not impose redundant
unit/integration/browser suites on every low-level operation or invent a global
coverage percentage.

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
| API unit tests | `go test -race ./...` | nothing |
| API feature tests | `run-feature-tests.sh`: `cmd/migrate` once, then `go test -race -tags feature -run '^TestFeature' ./...` (C77, C79) | PostgreSQL (roles script) and Redis |
| API image | builds the production image and runs its `migrate` | PostgreSQL |
| app / admin | frontend typecheck and build | nothing |

Merging a failing pull request is not blocked: required status checks need a paid GitHub
plan for private repositories. Check that CI passed before merging. Dependabot (C76)
update pull requests go through the same jobs.

### Unit and feature tests (C77)

- **Unit tests** need no external services: configuration, handlers, validation, logging,
  problem responses, and anything using fakes or `httptest`.
- **Feature tests** run against real PostgreSQL and Redis: the pool, migrations, role
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
not the owner's. Application code therefore accepts either the pool or a transaction
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

# Feature tests: a throwaway PostgreSQL (with erp_platform) and Redis on the "ci" network
.github/scripts/start-postgres.sh
docker run -d --name redis --network ci redis:8-alpine
.github/scripts/run-feature-tests.sh
docker rm -f postgres redis && docker network rm ci
```

Never point feature tests at a database with data you want to keep.

The checks below describe the rebuild target from the removed implementation.

The Go job runs formatting checks, vet, tests, and compilation in Docker against
`apps/api` only. Step 1 adds configuration and logging tests plus subprocess checks
of the real API entry point: startup, health, invalid settings, occupied ports,
SIGTERM shutdown, forced termination by a second signal, and structured lifecycle/error
logs. HTTP server tests hold a request open to verify successful draining and
connection closure at the shutdown deadline. Configuration errors and sensitive
log attributes are checked for value disclosure. Step 1 subprocess tests use
isolated environment values and need no database/cache services. The API CI job
also starts a fresh PostgreSQL 18 service for the step 3 integration check, which
creates disposable test roles, applies a test-only migration, checks runtime DML
and denied DDL, verifies runtime access to Goose history is denied, then removes
its test tables. Domain/application tests will follow
those implementations. Archived API tests are not run.
Frontend typecheck/build jobs remain, but the legacy E2E job is explicitly disabled
until the new API and identity contract are integrated.

Step 2 adds routing/HEAD/method tests, safe problem responses, request correlation,
private-data omission, malformed JSON, body limits, origin checks, and forwarded
header spoofing tests. Real TCP checks exercise slow header/body reads, expired
response writes, idle connection closure, oversized headers, chunked body limits,
and panics after a partial response. Step 3 adds pool/readiness checks, migration
tooling, and isolated PostgreSQL role/migration verification. CI's push branch is `dev`.
