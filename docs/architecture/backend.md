# Backend architecture

Status: hexagonal modular-monolith direction selected. The earlier implementation
was removed for a step-by-step rebuild (C24); the layout below is the target, and the
[HTTP foundation](../platform/http.md) and [PostgreSQL foundation](../platform/postgres.md)
describe target contracts, without approving application tables. Remaining policy contracts and tool choices are proposed. See
[the decision register](../decisions/README.md).

The new API lives in `apps/api/`; the previous implementation is preserved in
`apps/api.bak/`. Directories are created only when a step needs them. Filenames in
the target tree below illustrate future responsibilities unless listed as current;
they are not approved tables or contracts.

**Current layout (rebuild, step 4):**

```text
apps/api/
  cmd/
    api/main.go          process concerns: config, logger, signals, exit code
    migrate/main.go      explicit migrations with MIGRATE_DB_* (C46, C47)
  internal/
    bootstrap/           application assembly, one file per dependency
      bootstrap.go       Run: build dependencies, serve, close in reverse order
      database.go        PostgreSQL pool from config.DB
      redis.go           Redis client from config.Redis
      http.go            router, middleware, liveness/readiness, http.Server
    platform/
      config/            settings grouped by concern (C44)
      httpserver/        server limits and graceful shutdown (framework-agnostic)
      observability/     slog logger and redaction
      postgres/          pool, database/sql for Goose, migrations
      problem/           RFC 9457 errors and panic recovery
      redis/             fail-fast Redis client
      requestid/         request IDs
```

`main` loads configuration, builds the logger, and hands both to `bootstrap.Run`,
which constructs every dependency explicitly (no global container), serves HTTP,
and closes dependencies after the server has shut down. A new dependency gets its
own `bootstrap/<name>.go`. There are no application modules, generated query
packages, or application migrations yet.

## Target layout

```text
apps/api/
  cmd/
    api/main.go
    worker/main.go
    migrate/main.go

  internal/
    bootstrap/
      wiring.go
      routes.go
      workers.go

    platform/
      config/
      postgres/
        pool.go
        transaction.go
        tenant_scope.go
      httpserver/
        server.go
        middleware/
        response/
      observability/
        logging.go
        tracing.go
        metrics.go
      cache/
        redis/
      jobs/

    kernel/
      actor.go
      tenant_id.go

    modules/
      identity/
        domain/
        application/
        adapters/
      tenancy/
        domain/
        application/
        adapters/
      authorization/
        domain/
        application/
        adapters/
      audit/
        domain/
        application/
        adapters/
      hrms/
        domain/
          employee.go
          errors.go
        application/
          create_employee.go
          update_employee.go
          get_employee.go
          list_employees.go
          ports.go
        adapters/
          http/
            handlers.go
            routes.go
            requests.go
            responses.go
          postgres/
            employees.go
            transaction.go
            mapping.go
            queries/
              employees.sql
            internal/
              sqlc/

    web/

  migrations/
  api/openapi.yaml
  tests/
    integration/
    architecture/
  sqlc.yaml
  go.mod
  go.sum
```

The worker directory is a placeholder. The migration command is implemented,
but there are no application SQL migrations, generated query files, employee
types, or OpenAPI contract yet. The sqlc paths illustrate the deferred query
generation option. Kratos and Cerbos adapters are planned against the confirmed
provider choices; their detailed integration contracts remain open in the
[decision register](../decisions/README.md).
The `web` directory and generated frontend client belong to later integration.
A worker executable does not imply an additional Compose service now.

## Responsibilities and dependencies

| Area | Responsibility |
| --- | --- |
| Domain | Employee entities, allowed changes, business invariants, business errors; no HTTP, database, cache, or provider dependencies. |
| Application | Use cases, input/result types, access requirements, orchestration, and the ports those operations need. |
| Adapters | Translate HTTP/jobs into operations or implement persistence, provider, and cache dependencies. |
| Bootstrap | Construct concrete implementations and inject them into operations. |
| Platform | Technical infrastructure without employee or access-policy decisions. |
| Kernel | Only genuinely shared small types; not a shared business-logic container. |

Source dependencies point inward: adapters depend on application/domain contracts.
An application may call a persistence port at runtime without importing its
PostgreSQL implementation. HTTP and job adapters must not access tables directly.

Each capability owns its writes. Collaboration uses explicit application contracts,
and operations requiring atomic writes need an agreed transaction contract.
Generated SQL types remain inside persistence adapters under the proposed port design.

## Modules and routes (C92)

Every module keeps all of its code in its own folder (`internal/platform/<name>` for
infrastructure such as `auth`, `internal/modules/<name>` for business capabilities):
routes, handlers, middleware, and types. A module exposes `Routes(r chi.Router)`,
registering paths relative to its prefix (`/me`, not `/api/auth/me`). Bootstrap only
constructs modules and mounts them, in `internal/bootstrap/modules.go`:

```go
r.Route("/api/auth", m.auth.Routes) // GET /api/auth/me
```

Modules inherit the router's default middleware (request ID, request logging, panic
recovery, origin checks, body limit, tracing). Authentication is not a default: a
module applies it to its own routes (`r.Use(authModule.Authenticate)`), receiving the
auth module's middleware from bootstrap when it is not the auth module itself. There is
no generic module interface; bootstrap calls each module's `Routes` explicitly.

## PostgreSQL-only and persistence

PostgreSQL is selected. Database portability is not a goal. The proposed thin
persistence ports protect the application boundary; they do not promise another
database implementation. Do not add generic repositories, base classes, or unused
CRUD methods. The precise ports and transaction API are still open.

Calling sqlc/pgx directly from application code is a possible simplification only
if the application-independence requirement is explicitly revisited. A generated
query interface alone does not remove dependency on generated persistence types.

## Tool status

| Concern | Status |
| --- | --- |
| Go | Selected |
| PostgreSQL | Selected |
| Redis caching | Selected |
| HTTP routing | chi selected and implemented; routes registered in bootstrap, httpserver remains framework-agnostic |
| pgx/v5 pgxpool | Selected and implemented for the PostgreSQL pool |
| Goose | Selected and implemented for explicit migrations |
| sqlc | Deferred until an approved table needs generated queries |
| Structured slog logs | Implemented in platform step 1; JSON/info to stdout by default |
| OpenTelemetry | Proposed; propagation, exporter, and operational policy open |
| Identity/authentication | Ory Kratos selected; integration and lifecycle contracts open |
| Authorization | Cerbos selected; policy model and enforcement contracts open |
| File/object storage | S3 API selected; `chipaau/minio` (project's exact MinIO fork) selected for development |
| Queue implementation and Redis client | Open |

Audit and tracing are required. The request lifecycle and their relationship to
transactions and caching are described in [request-lifecycle.md](request-lifecycle.md).
