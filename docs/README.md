# Bool ERP documentation

Updated: 2026-09-27.

This is the current documentation for a fresh Go API in the GitHub `boolmv/erp`
monorepo at `/Users/chipaau/code/bool/erp`. See [repository transfer](repository-transfer.md)
for the corrected workspace and preserved security-review work.
The implementation scope is the platform backbone and HRMS employee records.
Frontend integration is deferred.

The previous API is preserved in `apps/api.bak/`. The rebuild contains a
standard-library HTTP foundation, validated runtime configuration, and structured
request logging. Start with the [development commands](development.md); persistence,
platform policy modules, tracing, and employee behavior remain to be implemented.

## Start here

1. [Product scope](product/scope.md)
2. [Confirmed decisions and open questions](decisions/README.md)
3. [API rebuild decision](adr/0001-api-rebuild.md)
4. [Backend structure](architecture/backend.md)
5. [Employee request lifecycle](architecture/request-lifecycle.md)
6. [Sequential roadmap and platform delivery plan](roadmap.md)

## Component documents

| Area | Document |
| --- | --- |
| HTTP routing, errors, and request limits | [HTTP foundation](platform/http.md) |
| Identity and authentication | [Identity](platform/identity.md) |
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

Previous specifications, ADRs, and earlier frontend/development documentation are preserved in
[the archive](archive/README.md). Their old approval and implementation labels do not
apply to this rebuild. Agent rules are maintained separately under `.claude/`,
with [AGENTS.md](../AGENTS.md) linking to [CLAUDE.md](../CLAUDE.md).
