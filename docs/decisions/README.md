# Decision register

Updated: 2026-09-28. Decisions are made one at a time.

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
| C17 | After merging step 1 into the updated dev branch, implement step 2 (HTTP foundation) on a new branch. |
| C18 | After step 2 merges, implement step 3 on a new branch using pgx/v5 pgxpool and Goose; defer sqlc until the first table is approved. |
| C19 | Use chi as the Go API HTTP framework. The step 2 scaffold currently uses `net/http` ServeMux; new API routing and its migration follow chi. |
| C20 | Use Ory Kratos as the identity and authentication system; session, provisioning, domain, and account contracts remain open. |
| C21 | Use Cerbos as the authorization policy engine; roles, resources, policy inputs, and revocation behavior remain open. |
| C22 | Use the S3 API for file/object storage; use `chipaau/minio`, the project's exact MinIO fork, as the development server. Production provider and Go SDK remain open. |

The initial `api-rebuild` branch was created from `develop` at `70eb43a` and merged
into `dev` at `639101d`. Step 2 used `feat/api-http-foundation`; step 3 uses
`feat/api-postgres-foundation` from updated `dev`.
See [repository transfer](../repository-transfer.md) for preserved work. The initial
scaffold used Go's standard library for startup, graceful shutdown, and
`GET /api/healthz`. Step 3 adds pgx/v5 and Goose for its approved PostgreSQL foundation.
The Go 1.27 module baseline matches the existing development container.

Platform step 1 now adds a typed environment configuration loader and standard-library
`slog` logging. Its implementation contract is JSON/info logs to stdout by default,
optional text output and level selection, validated port/environment/shutdown settings,
safe validation errors, and redaction of sensitive structured attributes. See
[development](../development.md) and [observability](../platform/observability.md)
for the exact settings and redaction limits. This closes the initial logging slice
of D07; it does not select tracing or broader telemetry policy.

Step 2's implementation currently uses `http.ServeMux`, introduces RFC 9457 problem
responses, server-generated request IDs, safe request logs, panic recovery, and
configured body/network limits. Its initial browser/proxy policy enables no
cross-origin CORS access and trusts no forwarded headers. The exact contract and
remaining identity/deployment boundaries are in [HTTP foundation](../platform/http.md).

ADR 0002 records the user's confirmed framework and provider choices. Chi is the
selected HTTP framework, while the existing step 2 HTTP foundation remains on
the standard library until its migration is made in an authorized implementation
change. Kratos, Cerbos, and S3/`chipaau/minio` are selected components, not completed
integrations. Their detailed contracts remain open below.

Step 3 selects pgx/v5 pgxpool for the runtime connection pool and Goose for the
explicit migration command. Runtime and migration credentials are separate;
the API does not receive the migration DSN. sqlc is deferred until the first
approved table needs queries. See the [PostgreSQL foundation](../platform/postgres.md).

Application persistence, Redis access, audit, and tracing are not implemented by
creating their directories. `cmd/migrate` is implemented but has no application
migrations. The worker executable and generated query/client contracts remain
placeholders.

## Open decisions

| Order | Decision | Recommendation or question, not approval |
| --- | --- | --- |
| D01 | Tenant versus licensed customer | Does one customer operate one tenant or a hierarchy of tenants? What does a tenant represent? |
| D02 | Tenant isolation and visibility | Pooled PostgreSQL tables with tenant_id and RLS are proposed; parent access, control-plane scope, and mutation policies need agreement. |
| D03 | Backend tools and persistence boundary | pgx/v5 pgxpool and Goose are selected. Defer sqlc until the first approved table/query. Thin module-owned persistence ports remain a recommendation; approve persistence and transaction contracts when a concrete use case needs them. |
| D04 | Identity, sessions, and domain login | Kratos is selected. Agree session validation/revocation, provisioning/status, identity scope, and login behavior for default/unrelated custom domains and self-hosting. |
| D05 | Authorization | Cerbos is selected. Agree roles, permission/resource semantics, trusted inputs, operator access, policy administration, and revocation behavior. |
| D06 | Transaction and audit contracts | Agree operation boundaries, audit capture, immutability, denied-action recording, redaction, and retention. |
| D07 | Tracing and logging | Runtime logging and HTTP request correlation/logs are implemented in steps 1–2. OpenTelemetry remains proposed; trace propagation, sampling, export, and retention remain open. |
| D08 | Cache contract | Redis is selected; decide cached data, key scope, TTL, invalidation, consistency, failure behavior, and client library. |
| D09 | Runtime and background work | Decide worker topology, queue library, retries, idempotency, and delivery guarantees. |
| D10 | Self-hosting and licensing | Decide required dependencies, offline operation, installation, upgrades, license scope, and expiry/grace behavior. |
| D11 | Employee model and API contract | Approve employee fields, identity linkage, lifecycle, tables, operations, validation, and response conventions. |
| D12 | File/object storage | S3 API and the `chipaau/minio` development server are selected. Choose the Go SDK, production provider, object key/tenant boundaries, upload/download flow, integrity, retention, and deletion behavior when a concrete file use case is defined. Recommend evaluating the official AWS SDK for Go v2 first; its S3 client and transfer utilities avoid hand-written S3 protocol handling ([official guide](https://docs.aws.amazon.com/sdk-for-go/v2/developer-guide/welcome.html)). This is a recommendation, not an SDK decision. |

**Next product-model discussion: D01.** Its answer has not been recorded. The user
has separately authorized the executable scaffold and platform steps 1–2; later
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

See [ADR 0001](../adr/0001-api-rebuild.md), [ADR 0002](../adr/0002-tool-and-provider-selection.md), and [product scope](../product/scope.md).
