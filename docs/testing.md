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

## Current CI boundary

The Go job runs formatting checks, vet, tests, and compilation in Docker against
`apps/api` only. There are no application test cases in the initial scaffold yet;
`go test ./...` currently checks package compilation. Archived API tests are not run.
Frontend typecheck/build jobs remain, but the legacy E2E job is explicitly disabled
until the new API and identity contract are integrated. See
[repository transfer](repository-transfer.md).
