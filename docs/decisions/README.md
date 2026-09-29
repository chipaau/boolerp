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
| C19 | Use chi as the Go API HTTP framework. The pre-reset step 2a migrated the HTTP foundation from `net/http` ServeMux to chi/v5; shared HTTP middleware behavior is preserved. Canonical redirect behavior is recorded in C23. |
| C20 | Use Ory Kratos as the identity and authentication system; session, provisioning, domain, and account contracts remain open. |
| C21 | Use Cerbos as the authorization policy engine; roles, resources, policy inputs, and revocation behavior remain open. |
| C22 | Use the S3 API for file/object storage; use `chipaau/minio`, the project's exact MinIO fork, as the development server. Production provider and Go SDK remain open. |
| C23 | Redirect paths changed by `path.Clean` with 307 Temporary Redirect, preserving the request method, body, and query. This intentionally differs from ServeMux's canonical-path redirect behavior. **Superseded by C39.** |
| C24 | On 2026-09-28 the user removed the `apps/api` implementation (branch `chore/reset-api`) to rebuild it from scratch for understanding. Rebuild order: a simple chi server, then configuration, then logging, then the remaining platform steps. Tool selections and contracts from C14–C23 still stand; their earlier implementation status does not. |
| C25 | Liveness uses chi's `middleware.Heartbeat("/api/healthz")`: `GET`/`HEAD` return `200` with `text/plain` body `.`. This replaces the earlier JSON `{"status":"ok"}` liveness response, following the framework-first rule. **Superseded by C36.** |
| C26 | Load runtime configuration from the process environment with `github.com/caarlos0/env/v11` (v11.4.1). The binary does not read dotenv files; `joho/godotenv` was considered and rejected because Compose already supplies `.env` values and reading files from the working directory is a risk for self-hosted installs. |
| C27 | Validate configuration with `github.com/go-playground/validator/v10` struct tags, chosen over a hand-written `Validate()` so one validation approach can later serve request input as well. Request-validation use remains to be confirmed when HTTP input is added. |
| C28 | Use `github.com/stretchr/testify` (v1.12.1) for test assertions, limited to the `require` and `assert` packages; `mock` and `suite` are not adopted. Tests otherwise use the standard `testing` package. |
| C29 | Redact sensitive log attributes with slog's built-in `HandlerOptions.ReplaceAttr` hook and the name-based word list in [observability](../platform/observability.md); the list extends the earlier rebuild's with `passwd`, `bearer`, `jwt`, `session`, and `encryptionkey` so session identifiers are never logged. `m-mizutani/masq` was considered and not adopted (pre-1.0, single maintainer; deep struct inspection is not required because call sites must log deliberate safe fields). HTTP request logging in step 2 uses `go-chi/httplog` with this logger rather than a custom request logger. |
| C30 | `APP_SHUTDOWN_TIMEOUT` must be at least `APP_HTTP_WRITE_TIMEOUT` (validator `gtefield`), so graceful shutdown can finish any request the server allows. Defaults: shutdown `35s` (maximum `10m`), Compose `stop_grace_period: 40s`. Trade-off: a deploy can wait up to 35s while a slow request finishes. |
| C31 | `net/http` server diagnostics (`http.Server.ErrorLog`) are logged at WARN, not ERROR, because most are client-caused (TLS handshake failures, malformed requests). Application failures and recovered panics (step 2e) log at ERROR. |
| C32 | CI runs `go test -race`. The Go dev and CI image (`docker/go.Dockerfile`) is the Debian-based `golang:1.27` because the race detector needs cgo; the production build image (`docker/api.Dockerfile`) is unchanged. |
| C33 | The server always generates its own request ID and returns it in `X-Request-Id`; any client-supplied `X-Request-Id` is discarded, because request IDs are log evidence. Accepting IDs from a trusted proxy is left to step 2f. |
| C34 | Request IDs use `github.com/go-chi/traceid` (v0.3.0; UUIDv7, response header, `request_id` on every context-aware log record) instead of chi's `middleware.RequestID`, whose IDs embed the server hostname and would expose container/pod names to clients. Request logging uses `github.com/go-chi/httplog/v3` with the OpenTelemetry schema, in line with the planned OpenTelemetry tracing. |
| C35 | Every response written by the API is JSON: handler results, errors (404, 405, 413, 500), and liveness. Exceptions are responses produced by Go's HTTP server before any application code runs (for example 400 for a malformed request, 431 for oversized headers, 505), which it writes as plain text with no hook to change them, and connections closed by a timeout, which receive no response. |
| C36 | Liveness is a normal chi route, `GET /api/healthz` returning `200` `{"status":"ok"}` (`HEAD` via `chi/middleware.GetHead`), replacing `middleware.Heartbeat` (C25) to satisfy C35. It receives a request ID but is excluded from request logs with httplog's `Skip` option. It checks no dependencies. |
| C37 | Error responses follow RFC 9457 problem details (`application/problem+json`), written by `internal/platform/problem` on the standard library: no maintained Go library adds more than the five-member struct (documented gap). `type` is `about:blank` with the HTTP status phrase as `title` until specific problem types are defined; `instance` is `urn:uuid:<request ID>`, matching `X-Request-Id` and the `request_id` log attribute; `detail` must be safe for clients. chi's `NotFound`/`MethodNotAllowed` hooks return problem details; the 405 handler rebuilds `Allow` with chi's route lookup because chi does not pass allowed methods to custom handlers (documented gap). Every response also carries `X-Content-Type-Options: nosniff` (chi `SetHeader`). |
| C38 | Handler panics are handled by `problem.Recoverer`, registered directly inside the request logger: it logs one ERROR record (`panic recovered`, with request ID and stack) and answers 500 problem details; if the response has already started it aborts the connection with `http.ErrAbortHandler` instead of appending to a partial body; deliberate `http.ErrAbortHandler` panics pass through unlogged. Panic values are not logged, except Go runtime errors (runtime-generated messages); other values are logged by type. chi's `Recoverer` and httplog's `RecoverPanics` cannot write a response body and log outside the redacted logger (documented gap); httplog's `RecoverPanics` stays enabled only as a backstop. |
| C39 | Paths match exactly: no path cleaning and no canonical redirects. Non-canonical paths (`/api//x`, `/api/x/`) are 404 problem details. API clients call exact URLs, and silent rewriting (chi `CleanPath`) risks proxy/application path-interpretation mismatches. Supersedes C23. Traefik cleans paths itself before forwarding, so the API only receives the cleaned form. |
| C40 | The client IP is taken from `X-Forwarded-For` by counting trusted proxy hops (`APP_HTTP_TRUSTED_PROXY_HOPS`, chi `ClientIPFromXFFTrustedProxies`): with N hops the client is the Nth entry from the right, and entries further left are client-supplied and ignored. `0` (default) ignores forwarded headers and uses the connection address (chi `ClientIPFromRemoteAddr`); Compose uses `1` for Traefik. Chosen over trusted CIDR ranges because container proxy IPs are dynamic and, on Docker Desktop, the client address falls inside the proxy's subnet. Deployments must set the real hop count, verify it once with a request from a known IP, and make the API reachable only through the proxy. |
| C41 | Cross-origin access is allowed only for configured origins (`APP_HTTP_ALLOWED_ORIGINS`, exact `scheme://host[:port]`, no wildcards; empty by default). `go-chi/cors` (v1.2.2) lets those origins read responses and answers preflight requests; it is installed only when the list is non-empty, because it treats an empty list as "allow all". Go's `http.CrossOriginProtection` rejects cross-origin state-changing browser requests (POST, PUT, PATCH, DELETE) from other origins with 403 problem details; same-origin and non-browser requests pass. Credentialed CORS is off until the session contract (D04); per-tenant custom-domain origins will need `AllowOriginFunc` and `AddTrustedOrigin` from the domain registry. |
| C42 | The pgxpool is created lazily at startup (no connection until first use), so the API starts and liveness answers while PostgreSQL is down; readiness reports database reachability. Invalid connection settings fail startup with a fixed message; pgx's parse error, which contains the connection string, is never wrapped. `APP_DB_MAX_CONNS` (default 20, 1–1000) is the only pool setting in configuration; others keep pgx defaults. |
| C43 | The API's PostgreSQL connection is configured with separate settings instead of one DSN: `APP_DB_HOST`, `APP_DB_NAME`, `APP_DB_USER`, `APP_DB_PASSWORD` (required, no defaults, so no credentials in code), `APP_DB_PORT` (5432), and `APP_DB_SSLMODE`. The password stays a single secret value suitable for secret managers, needs no URL escaping (the connection URL is built with `net/url`), and errors name the exact setting. `APP_DB_SSLMODE` defaults to `verify-full` and accepts `disable`, `require`, `verify-ca`, `verify-full`; pgx's `allow` and `prefer` are rejected because they silently fall back to unencrypted connections. Compose sets `disable` and derives name, user, and password from the PostgreSQL role settings. Chosen over libpq `PG*` variables, which pgx reads directly from the process environment and would bypass configuration validation. |
| C44 | Configuration is grouped by concern, one file and struct per group in `internal/platform/config`, like Laravel's config files: `app.go` (`App`: `APP_ENV`, `APP_PORT`, `APP_SHUTDOWN_TIMEOUT`), `log.go` (`APP_LOG_*`), `http.go` (`APP_HTTP_*`), `database.go` (`APP_DB_*`). Groups use `caarlos0/env` `envPrefix`, so variable names are unchanged. Go field names are unique across groups (enforced by a test) because `caarlos0/env` parse errors report only the field name. Rules spanning groups (C30) use validator struct-level validation, since validator's cross-struct tags cannot reach sibling structs. Environment variables remain the only source (C26). |
| C45 | `GET /api/readyz` reports whether the API's dependencies (currently PostgreSQL, via `pool.Ping`) can be reached within `APP_DB_PING_TIMEOUT` (default 2s, max 1m): `200` `{"status":"ready"}` or `503` problem details with a generic detail. The cause is logged at WARN with the request ID, never returned; successful checks are not request-logged. The Compose health check (and so Traefik routing) stays on liveness (`/api/healthz`): with a single instance, routing away during an outage only replaces the API's JSON 503 with Traefik's plain-text error, and restarting the process does not fix a dependency. Readiness is for multi-instance load balancers and orchestrators (for example a Kubernetes `readinessProbe`) and monitoring. |
| C46 | Migrations run through Goose as a library in `cmd/migrate`, with SQL files embedded in the release binary (`internal/platform/postgres/migrations/sql`), a PostgreSQL advisory lock (`lock.NewPostgresSessionLocker`) serializing concurrent runs, history in `migrations.goose_db_version`, and logs through the application logger. Migrations are forward-only: only `-- +goose Up` sections, no down command; mistakes are fixed forward and recovery uses backup/restore (D10). Chosen over the goose CLI so each release carries its own migrations with no extra tool. The command pings first so bad credentials fail even with nothing to apply, and reports failures without statement text or PostgreSQL detail. |
| C47 | `cmd/migrate` uses its own `MIGRATE_DB_*` settings (host, port, name, user, password, sslmode; same rules as C43) and reads nothing from `APP_*`; the API never receives them. The migration role can change the schema and the runtime role cannot, so a compromised API cannot alter or drop schema objects, and migrations can connect to a different endpoint than the API (directly, bypassing a transaction pooler such as PgBouncer). |
| C48 | Direction for when the first module table is approved: each module owns its migrations in its own folder (for example `internal/modules/tenancy/adapters/postgres/migrations`), embedded by that module's package, with its own Goose history table (`migrations.<module>_version`). `cmd/migrate` runs the modules in a fixed dependency order (tenancy, identity, authorization, audit, hrms), so tables referenced by another module exist first. Each module's run keeps C46's lock, forward-only rule, and safe errors. Chosen over one global folder (modules would not own their migrations) and over merging folders into one sequence (cross-module version collisions and custom merging code). Not implemented yet: no module has tables, and empty module folders are not created ahead of need; the empty global folder is removed when the first module folder is added. |
| C49 | Local development data is disposable: Compose volumes (such as `erp_pgdata`) may be reset whenever needed. With an empty `pgdata` volume, PostgreSQL creates the `erp` database and `10-roles.sh` creates the runtime and migration roles and the `migrations` schema on first start, as Laravel Sail does; tables come from `cmd/migrate`. The old API's development data was removed on 2026-09-29. |
| C50 | Development and test data comes from seeds, like Laravel seeders: a Go command (`cmd/seed`) that creates data through the application's use cases, so seeded data passes the same tenant, validation, and audit rules as real data, and seeded users can log in through Kratos (C20). SQL seed files (Goose's `WithDisableVersioning`) were not chosen because they bypass those rules and cannot create Kratos identities. Seeds run in every environment except production, and fail closed: `cmd/seed` requires `APP_ENV` to be set explicitly (the API's `dev` default does not apply) to `dev`, `test`, or `staging`, refuses otherwise, and is not built into the production image. Seed data is generated, never real personal data, and can run repeatedly without duplicating. Not implemented yet: built with the first use case (step 6 or 7). |

**Reset notice (C24):** the paragraphs below describe the contracts of the removed
implementation. Treat them as the rebuild target; nothing in `apps/api` is
currently implemented.

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

Step 2's implementation introduces RFC 9457 problem responses, server-generated
request IDs, safe request logs, panic recovery, and configured body/network limits.
The pre-reset step 2a migrated routing from `net/http` ServeMux to chi/v5, preserving the shared
middleware behavior. Canonical path cleanup intentionally uses the method-preserving
307 policy recorded in C23. Its initial browser/proxy policy enables no
cross-origin CORS access and trusts no forwarded headers. The exact contract and
remaining identity/deployment boundaries are in [HTTP foundation](../platform/http.md).

ADR 0002 records the user's confirmed framework and provider choices. Chi is the
selected and implemented HTTP framework. Kratos, Cerbos, and S3/`chipaau/minio`
are selected components, not completed
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
