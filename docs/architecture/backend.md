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

**Current layout (rebuild, step 7c-4):**

```text
apps/api/
  cmd/
    api/main.go          process concerns; mounts the edition's modules (C93)
    migrate/main.go      applies the edition's module migrations with MIGRATE_DB_* (C46, C47, C95)
    bff/main.go          one backend-for-frontend instance, such as bff-workspace (C90, C96)
  internal/
    bff/                 the BFF's own packages; no database
      login/             /auth/login and /auth/callback with Hydra (PKCE, state, nonce)
      session/           scs sessions in the session Redis; AES-256-GCM sealed tokens
      proxy/             /api/* to the API with the session's token, refreshing it (C98)
      web/               the embedded app (app/ holds a placeholder until a release build, C99)
    bootstrap/           application assembly, one file per dependency
      bootstrap.go       Run: build dependencies, call RegisterModules, serve
      bff.go             RunBFF: the BFF with the same router middleware and telemetry
      database.go        PostgreSQL pool from config.DB
      redis.go           Redis clients: the API's cache, the BFF's session store
      http.go            router, middleware, liveness/readiness, http.Server
      tracing.go, metrics.go
    edition/
      full/              every module: RegisterModules, Migrations, and Seeders (C95, C118)
    platform/            infrastructure and platform capabilities (C122)
      identity/          users (C94)
        identity.go      New, Resolve, EnsureAccount, Migrations
        domain/          User, Account, NewAccount
        application/     Service (Resolve, Sync, EnsureAccount) and its ports
        adapters/
          kratos/        Kratos admin API through ory/client-go
          store/         users in PostgreSQL
        migrations/      embedded Goose SQL, history migrations.identity_version
        seeds/           one seeder per store: users.go (C50, C118)
      reference/         shared reference data: countries (C122)
        migrations/      history migrations.reference_version
      auth/              access tokens, Authenticate, the caller, GET /api/auth/me (C91, C92)
      config/            settings grouped by concern (C44)
      httpinput/         JSON request decoding and validation
      httpserver/        server limits and graceful shutdown (framework-agnostic)
      seed/              the Seeder interface, the runner, and the shared gofakeit generator (C118)
      observability/     slog logger and redaction, tracing, metrics
      postgres/          pool, database/sql for Goose, module migrations
      problem/           RFC 9457 errors and panic recovery
      redis/             fail-fast Redis client
      requestid/         request IDs
    testdb/              feature-test transactions as the runtime role
```

`main` loads configuration, builds the logger, and hands both to `bootstrap.Run` with
its edition's `RegisterModules`. `bootstrap.Run` constructs every dependency explicitly
(no global container), lets the edition mount its modules, serves HTTP, and closes
dependencies after the server has shut down. A new dependency gets its own `bootstrap/<name>.go`.

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
          store/
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

The worker directory is a placeholder. The target tree predates C95: migrations
live in each module's `migrations` folder, not a global `migrations/`. There are no
generated query files, employee types, or OpenAPI contract yet. The sqlc paths illustrate the deferred query
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
A module's database adapter is `adapters/store` (package `store`), named by its role
rather than the database, so it never clashes with `internal/platform/postgres`;
adapters for external providers are named after the provider (`adapters/kratos`).

## Modules and routes (C92, C93, C95)

Every module keeps all of its code in its own folder (C122): `internal/platform/<name>`
for technical infrastructure (`postgres`, `redis`, `auth`) and for the platform
capabilities that own tables (`identity`, `reference`, later `tenancy`, `authorization`,
`audit`); `internal/modules/<name>` for business apps only (HRMS first). Each folder holds its
routes, handlers, middleware, types, and migrations. A module exposes
`Routes(r chi.Router)` when it has routes, registering
paths relative to its prefix (`/me`, not `/api/auth/me`).

An **edition package** (`internal/edition/<name>`) lists a product edition's modules
once. Its `RegisterModules` is the callback `bootstrap.Run` calls with the public
router and `bootstrap.Deps`; it constructs the modules, wires
them to each other explicitly, and mounts them. Its `Migrations` lists the modules'
embedded migrations in dependency order for `cmd/migrate`:

```go
// internal/edition/full/full.go
var Migrations = []postgres.ModuleMigrations{{Name: "identity", FS: identity.Migrations()}}

func RegisterModules(ctx context.Context, r chi.Router, d bootstrap.Deps) {
	users := identity.New(d.Pool, identity.Settings{...}, d.HTTPClient)
	resolve := func(ctx context.Context, subject string) (auth.User, error) { ... users.Resolve ... }
	authModule := auth.New(ctx, auth.Settings{...}, d.HTTPClient, resolve, d.Logger)
	r.Route("/api/auth", authModule.Routes) // GET /api/auth/me
}
```

Each edition has its own `main` packages (`cmd/api`, `cmd/migrate`, later for example
`cmd/api-hrms`) that import its edition package; modules an edition does not list are
not compiled into its binaries, and a binary and its migrator always agree. There is
no generic `Module` interface or container.

**Dependencies between modules:** business modules may depend on platform modules. A
module that needs another business module defines the interface it needs in its own
`application` package, and the edition passes the other module in. Platform modules
never import business modules: `auth` receives a `ResolveUser` function, which the
edition builds from the identity module. No module reads another module's tables.

Modules inherit the router's default middleware (request ID, request logging, panic
recovery, origin checks, body limit, tracing). Authentication is not a default: a
module applies it to its own routes (`r.Use(authModule.Authenticate)`), receiving the
auth module's middleware from the edition when it is not the auth module itself.
Handlers read the caller (token and user) with `auth.FromContext`.

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
| Identity/authentication | Ory Kratos and Hydra selected; access tokens (C91) and users (C94) implemented; session lifecycle contracts open |
| Authorization | Cerbos selected; policy model and enforcement contracts open |
| File/object storage | S3 API selected; `chipaau/minio` (project's exact MinIO fork) selected for development |
| Queue implementation and Redis client | Open |

Audit and tracing are required. The request lifecycle and their relationship to
transactions and caching are described in [request-lifecycle.md](request-lifecycle.md).
