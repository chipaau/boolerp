# Backend architecture

Status: hexagonal modular-monolith direction selected; directory scaffold,
HTTP entry point, runtime configuration, and structured logging implemented.
Remaining contracts and tool choices are proposed. See
[the decision register](../decisions/README.md).

The new API lives in `apps/api/`; the previous implementation is preserved in
`apps/api.bak/`. The target directories are scaffolded with `.gitkeep` files where
implementation is deferred. Filenames in this tree illustrate future responsibilities
unless listed as current below; they are not approved tables or contracts.

Current runtime code lives in `cmd/api`, `internal/bootstrap`, and
`internal/platform/{config,httpserver,observability}`. It implements validated
configuration, structured logging, process lifecycle, and `GET /api/healthz`.
The entry point loads configuration and constructs the logger; bootstrap passes
explicit settings and the logger to the HTTP server. No global logger is replaced.
`APP_PORT` defaults to 8080. There are no external Go dependencies or `go.sum`.

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

Empty worker/migration directories do not contain runnable commands. There are no
SQL migrations, generated query files, employee types, or OpenAPI contract yet.
The sqlc paths illustrate the recommended persistence option. Identity and
authorization provider adapters are added only after their engines are selected.
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
| Chi, pgx, sqlc, Goose | Recommended candidates; not re-confirmed for the fresh implementation |
| Structured slog logs | Implemented in platform step 1; JSON/info to stdout by default |
| OpenTelemetry | Proposed; propagation, exporter, and operational policy open |
| Authentication and authorization engines | Open; former providers are not inherited |
| Queue implementation and Redis client | Open |

Audit and tracing are required. The request lifecycle and their relationship to
transactions and caching are described in [request-lifecycle.md](request-lifecycle.md).
