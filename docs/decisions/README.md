# Decision register

Updated: 2026-09-26. Decisions are made one at a time.

## Confirmed baseline

| ID | Decision or requirement |
| --- | --- |
| C01 | Rebuild the Go API from scratch in the existing monorepo; previous implementation choices are not binding. |
| C02 | Use a modular monolith with hexagonal domain/application/adapter boundaries. |
| C03 | PostgreSQL is the application database. Multi-database portability is not a goal. |
| C04 | Redis is retained for caching; caching is a required backbone capability. |
| C05 | Audit and tracing are required, distinct backbone capabilities. |
| C06 | Current business scope is HRMS employee records only, supported by the platform backbone. |
| C07 | Frontend integration is deferred. |
| C08 | Development Compose contains only api, app, postgres, and redis. |
| C09 | Support hosted multi-tenancy, default domains, verified custom domains, and self-hosting with the same codebase/release. |
| C10 | English UI; Dhivehi content only where needed. |
| C11 | Distribute binaries/containers with licensing controls that discourage unauthorized resale; binaries are not tamper-proof. |
| C12 | Project documentation lives in docs/; substantive agent rules live in .claude/. AGENTS.md links to CLAUDE.md. |
| C13 | Make the remaining decisions sequentially and confirm schemas table by table before implementation. |
| C14 | Archive the previous API as apps/api.bak, scaffold the proposed structure, and start with a simple API entry point; build subsequent layers incrementally. |
| C15 | The canonical repository is the GitHub erp checkout; create api-rebuild from updated develop and preserve the newer frontend and security-review work. |
| C16 | Implement platform delivery step 1: runtime configuration, validation, structured logging, redaction, and explicit runtime wiring. |

The working branch is `api-rebuild`, created from `develop` at `70eb43a`.
See [repository transfer](../repository-transfer.md) for preserved work. The first scaffold uses Go's standard library
for startup, graceful shutdown, and `GET /api/healthz`, with no external Go dependencies.
This is an initial implementation choice, not a decision against a future router or
provider. The Go 1.27 module baseline matches the existing development container.

Platform step 1 now adds a typed environment configuration loader and standard-library
`slog` logging. Its implementation contract is JSON/info logs to stdout by default,
optional text output and level selection, validated port/environment/shutdown settings,
safe validation errors, and redaction of sensitive structured attributes. See
[development](../development.md) and [observability](../platform/observability.md)
for the exact settings and redaction limits. This closes the initial logging slice
of D07; it does not select tracing or broader telemetry policy.

Domain/application layers, database access, Redis access, audit, and tracing are
not implemented by creating their directories. Worker/migration executables and
generated query/client contracts remain placeholders.

## Open decisions

| Order | Decision | Recommendation or question, not approval |
| --- | --- | --- |
| D01 | Tenant versus licensed customer | Does one customer operate one tenant or a hierarchy of tenants? What does a tenant represent? |
| D02 | Tenant isolation and visibility | Pooled PostgreSQL tables with tenant_id and RLS are proposed; parent access, control-plane scope, and mutation policies need agreement. |
| D03 | Backend tools and persistence boundary | Chi, pgx, sqlc, and Goose are candidates. Thin application-owned ports are recommended; no generic repository framework. Direct sqlc in application code would reopen C02's independence boundary. |
| D04 | Identity, sessions, and domain login | Choose the authentication provider/session authority and validate default domains, unrelated custom domains, and self-hosted login together. |
| D05 | Authorization | Agree role/permission semantics, provider or in-process implementation, and access revocation behavior. |
| D06 | Transaction and audit contracts | Agree operation boundaries, audit capture, immutability, denied-action recording, redaction, and retention. |
| D07 | Tracing and logging | Initial structured logging implemented in step 1. OpenTelemetry remains proposed; request correlation, propagation, sampling, export, and retention remain open. |
| D08 | Cache contract | Redis is selected; decide cached data, key scope, TTL, invalidation, consistency, failure behavior, and client library. |
| D09 | Runtime and background work | Decide worker topology, queue library, retries, idempotency, and delivery guarantees. |
| D10 | Self-hosting and licensing | Decide required dependencies, offline operation, installation, upgrades, license scope, and expiry/grace behavior. |
| D11 | Employee model and API contract | Approve employee fields, identity linkage, lifecycle, tables, operations, validation, and response conventions. |

**Next product-model discussion: D01.** Its answer has not been recorded. The user
has separately authorized the executable scaffold and platform step 1; later
technical layers can be discussed without assuming an answer to D01. This queue does not ask for
approval of all rows at once.

## Interpretation

Removing identity/authorization services from Compose does not select replacement
engines or authorize bypassing their protections. PostgreSQL-only does not
automatically remove application ports. Redis caching does not make Redis the
authority for business records or audit history.

Detailed documents describe requirements and proposals; only a recorded user
decision changes a row from open to confirmed. Earlier archived approvals do not
carry forward automatically.

See [ADR 0001](../adr/0001-api-rebuild.md) and [product scope](../product/scope.md).
