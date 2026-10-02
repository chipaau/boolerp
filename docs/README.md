# Bool ERP documentation

Updated: 2026-09-28.

This is the current documentation for a fresh Go API in the GitHub `boolmv/erp`
monorepo at `/Users/chipaau/code/bool/erp`.
The implementation scope is the platform backbone and HRMS employee records.
Frontend integration is deferred.

On 2026-09-28 the rebuild's
earlier implementation was removed so it can be rebuilt step by step (C24);
`apps/api` currently contains no implementation. Chi, pgx/v5 pgxpool, Goose, and
`slog` remain the selected tools. See the [roadmap](roadmap.md) for the rebuild order,
starting with a simple chi server.

## Start here

1. [Product scope](product/scope.md)
2. [Confirmed decisions and open questions](decisions/README.md)
3. [API rebuild decision](adr/0001-api-rebuild.md)
4. [Framework and provider decisions](adr/0002-tool-and-provider-selection.md)
5. [Backend-for-frontend service](adr/0003-browser-bff-service.md)
6. [Workspace apps as packages](adr/0004-frontend-apps-as-packages.md)
7. [Backend structure](architecture/backend.md)
8. [Frontend structure](architecture/frontend.md)
9. [Employee request lifecycle](architecture/request-lifecycle.md)
10. [Sequential roadmap and platform delivery plan](roadmap.md)

## Component documents

| Area | Document |
| --- | --- |
| HTTP routing, errors, and request limits | [HTTP foundation](platform/http.md) |
| API conventions (versioning, naming, IDs, lists, OpenAPI) | [API conventions](platform/api-conventions.md) |
| PostgreSQL pool, readiness, and migrations | [PostgreSQL foundation](platform/postgres.md) |
| File and object storage | [Storage](platform/storage.md) |
| Identity and authentication | [Identity](platform/identity.md) |
| Apps and their backend-for-frontend | [App integration](platform/bff-frontend.md) |
| Tenants, memberships, and domains | [Tenancy](platform/tenancy.md) |
| Access decisions | [Authorization](platform/authorization.md) |
| Business audit trail | [Audit](platform/audit.md) |
| Tracing and logging | [Observability](platform/observability.md) |
| Redis caching | [Caching](platform/caching.md) |
| Transactions and background work | [Execution](platform/execution.md) |
| SaaS, self-hosting, and licensing | [Deployment](platform/deployment.md) |
| Employee business behavior | [HRMS employees](hrms/employees.md) |
| Schema approval status | [Data model](data-model/README.md) |
| Repository and tooling | [Development](development.md) |
| Verification strategy | [Testing](testing.md) |

## Status and authority

- **Confirmed:** explicitly selected requirements or architecture direction.
- **Proposed:** recommendations and example contracts awaiting a decision.
- **Open:** a question that has not been answered.
- **Implemented:** built and validated in the new API; documentation alone never earns this status.
- **Archived:** historical material with no authority over the rebuild.

The [decision register](decisions/README.md) records what is confirmed. Individual
component documents develop proposals without silently approving them. Decisions
are discussed one at a time; no rebuild schema is approved yet.

Previous specifications, ADRs, and documentation are not kept in the repository;
git history holds them. Agent rules are maintained separately under `.claude/`,
with [AGENTS.md](../AGENTS.md) linking to [CLAUDE.md](../CLAUDE.md).
