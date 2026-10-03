# Backend architecture

Status: hexagonal modular monolith, rebuilt step by step from 2026-09-28 (C24). The
current layout below is implemented; the target layout shows where later capabilities
and business apps go. See [the decision register](../decisions/README.md).

The new API lives in `apps/api/`. Directories are created only when a step needs them. Filenames in
the target tree below illustrate future responsibilities unless listed as current;
they are not approved tables or contracts.

**Current layout:**

```text
apps/api/
  cmd/
    api/main.go          process concerns; mounts the edition's modules (C93)
    migrate/main.go      applies the edition's module migrations with MIGRATE_DB_* (C46, C47, C95)
    bff/main.go          one backend-for-frontend instance, such as bff-workspace (C90, C96)
    seed/main.go         development and test data through the edition's seeders (C50, C118)
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
    platform/            platform capabilities: tables or policy (C122, C125)
      identity/          users and authentication (C94)
        identity.go      New, Resolve, EnsureAccount, Migrations
        auth/            access tokens, Authenticate, the caller, GET /api/auth/me (C91)
        domain/          User, Account, NewAccount
        application/     Service (Resolve, Sync, EnsureAccount) and its ports
        adapters/
          kratos/        Kratos admin API through ory/client-go
          hydra/         Hydra admin API: ending logins (C101)
          store/         users in PostgreSQL
        migrations/      embedded Goose SQL, history migrations.identity_version
        seeds/           one seeder per store: users.go (C50, C118)
      reference/         shared reference data: countries (C122)
        migrations/      history migrations.reference_version
      kit/               technical building blocks, no business meaning (C125)
        config/          settings grouped by concern (C44)
        httpinput/       JSON request decoding and validation
        httpserver/      server limits and graceful shutdown (framework-agnostic)
        seed/            the Seeder interface, the runner, and the shared gofakeit generator (C118)
        observability/   slog logger and redaction, tracing, metrics
        postgres/        pool, database/sql for Goose, module migrations
        problem/         RFC 9457 errors and panic recovery
        redis/           fail-fast Redis client
        requestid/       request IDs
        testdb/          feature-test transactions as the runtime role
```

A capability grows into one shape (C125): a root package with `New`, `Routes`, and
`Migrations`, and `domain/`, `application/`, `adapters/`, `migrations/`, and `seeds/`
as it needs them; sub-capabilities, such as identity's `auth`, are subpackages of it.

`main` loads configuration, builds the logger, and hands both to `bootstrap.Run` with
its edition's `RegisterModules`. `bootstrap.Run` constructs every dependency explicitly
(no global container), lets the edition mount its modules, serves HTTP, and closes
dependencies after the server has shut down. A new dependency gets its own `bootstrap/<name>.go`.

## Target layout

Later capabilities and business apps follow the current shape (C122, C125):

```text
apps/api/internal/
  platform/                capabilities: identity (with auth), reference, then
    tenancy/ authorization/ audit/   each: New, Routes, Migrations, plus domain/,
                           application/, adapters/, migrations/, seeds/ as needed
    kit/                   technical building blocks (config, postgres, redis, http, …)
  modules/                 business apps, HRMS first
    hrms/
      domain/  application/  adapters/ (http, store with sqlc queries)  migrations/  seeds/
```

There is no worker executable, no generated query code, and no API contract file
yet: sqlc is selected (C116) and arrives with the first tenancy tables; the business
API contract and client generation are integration standards still to set (C128).

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

Every module keeps all of its code in its own folder (C122, C125): `internal/platform/<name>`
for the platform capabilities (`identity` with `identity/auth`, `reference`, later
`tenancy`, `authorization`, `audit`), `internal/platform/kit/<name>` for technical
infrastructure (`postgres`, `redis`, `httpserver`, …), and `internal/modules/<name>`
for business apps only (HRMS first). Each folder holds its
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
var Migrations = []postgres.ModuleMigrations{
	{Name: "reference", FS: reference.Migrations()},
	{Name: "identity", FS: identity.Migrations()},
}

func RegisterModules(ctx context.Context, r chi.Router, d bootstrap.Deps) {
	users := identity.New(d.Pool, identity.Settings{...}, d.HTTPClient, d.Logger)
	// Authentication resolves a token's subject to its user through identity.
	authModule := auth.New(ctx, auth.Settings{...}, d.HTTPClient, users, d.Logger)
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
never import business modules. Within a capability, a subpackage may use its parent:
`identity/auth` resolves users through the identity module, behind a small `Users`
interface. No module reads another module's tables.

Modules inherit the router's default middleware (request ID, request logging, panic
recovery, origin checks, body limit, tracing). Authentication is not a default: a
module applies it to its own routes (`r.Use(authModule.Authenticate)`), receiving the
authentication middleware (`identity/auth`) from the edition.
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
| Go, PostgreSQL, Redis | Selected and implemented |
| HTTP routing | chi, implemented; the edition mounts modules (C95) |
| pgx/v5 pgxpool, Goose | Implemented: the pool and per-module migrations |
| sqlc | Selected (C116); not used yet, the `users` store is hand-written pgx |
| Structured slog logs | Implemented (step 1) |
| OpenTelemetry | Implemented: tracing (C54-C63) and metrics (C82); production backend open |
| Identity/authentication | Kratos and Hydra; access tokens (C91), users (C94), BFF sessions and logout (C96-C101) implemented; custom-domain login open |
| Authorization | Cerbos selected; tables designed (C116); policies and integration open (D05) |
| Redis client | go-redis (C51); cache optional, fail fast (C52) |
| Queue and background work | Open (D09) |
| File/object storage | S3 API selected; `chipaau/minio` for development; Go SDK open (D12) |

Audit and tracing are required. The request lifecycle and their relationship to
transactions and caching are described in [request-lifecycle.md](request-lifecycle.md).
