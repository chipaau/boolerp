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

## Current CI boundary

**Reset (C24, 2026-09-28):** the `API tests` CI job runs formatting, vet, tests,
and the `cmd/api` build in Docker. It has no PostgreSQL service; that returns with
step 3. The checks below describe the rebuild target, not current CI.

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
