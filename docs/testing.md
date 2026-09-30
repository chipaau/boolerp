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

**Lint (C75):** the `API tests` job first runs `golangci-lint` v2.14.0 with
`apps/api/.golangci.yml`, and fails on any finding. Run it locally with:

```sh
docker run --rm -v "$PWD/apps/api:/src" -w /src golangci/golangci-lint:v2.14.0 golangci-lint run ./...
```

Dependabot (C76) opens weekly grouped update pull requests, which go through the same CI.

**Current CI (step 3c):** the `API tests` job starts a fresh PostgreSQL 18 initialized
by `docker/postgres/init/10-roles.sh` (the same script as Compose), then runs
formatting, vet, and `go test -race` with the `POSTGRES_TEST_*` variables set, so the
database tests run: pool connection, migrations (once, concurrent runs, failure
reporting, connection failure), and the runtime role's privileges. It builds both
binaries, builds the production image, and runs that image's `migrate` command. A
Redis container (`REDIS_TEST_HOST`) lets the Redis client test run against a real
server; without it that test is skipped.

To run the database tests locally, start the same kind of container and pass
`POSTGRES_TEST_HOST`, `POSTGRES_TEST_DB`, `POSTGRES_TEST_APP_USER`/`_PASSWORD`, and
`POSTGRES_TEST_MIGRATE_USER`/`_PASSWORD`; without them those tests are skipped. Never
point them at a database with data you want to keep.

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
until the new API and identity contract are integrated. See
[repository transfer](repository-transfer.md).

Step 2 adds routing/HEAD/method tests, safe problem responses, request correlation,
private-data omission, malformed JSON, body limits, origin checks, and forwarded
header spoofing tests. Real TCP checks exercise slow header/body reads, expired
response writes, idle connection closure, oversized headers, chunked body limits,
and panics after a partial response. Step 3 adds pool/readiness checks, migration
tooling, and isolated PostgreSQL role/migration verification. CI's push branch is `dev`.
