# Architecture rules

Read [architecture/backend.md](../../docs/architecture/backend.md) and
[architecture/request-lifecycle.md](../../docs/architecture/request-lifecycle.md).

- Keep domain and application logic independent of HTTP frameworks, database drivers,
  generated persistence models, cache clients, and external provider SDKs.
- Put external implementations in adapters and dependency construction in bootstrap.
- `internal/platform/` holds the platform capabilities, things with tables or policy
  (identity with its `auth`, reference, later tenancy, authorization, audit), and
  `internal/platform/kit/` the technical building blocks with no business meaning
  (config, postgres, redis, http, problem, observability, requestid, seed, testdb)
  (C122, C125). `internal/modules/` holds business apps only (HRMS, inventory, …).
- A capability grows into one shape: a root package with `New`, `Routes`, and
  `Migrations`, plus `domain/`, `application/`, `adapters/`, `migrations/`, and `seeds/`
  as needed; sub-capabilities are subpackages (`identity/auth`).
- Inside a module (C200, [backend](../../docs/architecture/backend.md#modules-and-routes-c92-c93-c95)):
  `routes.go` lists the routes only; handlers are one file per resource with that
  resource's request and response types; endpoint tests split the same way. Small
  platform modules stay flat; business modules put routes and handlers in `adapters/http/`.
- Every file in a module is named for its resource, in every layer (C207): handlers, use
  cases and rules, store SQL, seeds, and tests (`tenants.go`, `store/tenants.go`,
  `tenants_feature_test.go`, `tenants_endpoint_feature_test.go`). Never name a file for an
  action (`create.go`, `list.go`) or a kind of code (`checks.go`, `lists.go`). Shared code
  goes in the file named for the package; exceptions are `middleware.go` and
  `store/lookups.go`. `kit/*`, `bootstrap`, and `bff/*` are organised by concern.
- Validation (C208, [API conventions](../../docs/platform/api-conventions.md)): the request
  struct holds every rule needing no data (`validate` tags; shared formats only from
  `request`; a struct-level rule beside the request for the module's own), only if the
  database also guards it or it is pure shape; the use case holds the rules needing data,
  in the writing transaction. No validation tag queries the database.
- Use the kit's shared helpers; never re-implement them in a module:
  - requests (`kit/request`): `request.Decode` (body, `validate` tags), `request.ParseList`
    with a `ListSpec`, the shared tags (`phone`, `slug`, `notblank`, plus the validator's own),
    and `request.RegisterStructValidation` for a request's own rules (C208);
  - success responses only through `kit/response` (C210): `response.OK`, `response.Created`
    (with `Location`), `response.NoContent`, `response.Page` for every list; never a
    hand-written encoder or Content-Type;
  - errors only through `kit/problem`: `problem.Unavailable` for a failed dependency,
    `problem.Error` for other statuses, `authorization.WriteError` after a Cerbos check;
  - redirects, files, and proxied responses (the BFF) use the standard library;
  - field errors from a use case: `var v problem.ValidationError; v.Add(path, code, detail)`,
    `return v.Err()`, or `problem.Invalid(path, code, detail)` for one field; paths are JSON
    paths (`institutionTypes/1/code`), pointers come from `problem.Field`/`problem.Pointer`.
  - "in use now" in SQL: `is_current(active_from, active_to)` (C211), never a hand-written
    condition; a `<field>_translations` column's check: `is_translations(...)` (C216);
  - lists in a store: `postgres.ListQuery` (`Where`, `Equal`, `Search`, `Run`: sorts, a
    stable key, the window count, past-last-page counting); seed files: `seed.ReadCSV`;
  - route protection: the named chains of `platform.Services`, built with
    `platform.ChainParts` (the edition and tests alike);
  - tests: `testdb.Exec`, `ID`, `Savepoint`, `PgCode`, `Savepoints` (code that begins its
    own transactions inside the test's), and `authztest.Stated` for Cerbos.
  A helper several modules need is added to the kit first, then used.
- A module owns its persistence writes. Do not reach into another module's SQL package.
- Design every module so it can become a separate service later, all services sharing
  one PostgreSQL database (C134). Foreign keys across modules are allowed, always
  `ON DELETE RESTRICT` and only to a stable key (`id`, `code`). Another module's data is
  read only through the read-only views its owner publishes, each `security_invoker = true`
  and tested as the runtime role; never join another module's tables. No transaction
  spans modules: effects in another module go through an outbox event written in the
  same transaction and handled idempotently.
- Business modules receive the platform as one `platform.Services` bundle from the
  edition and protect routes with its named chains (`TenantUser`, `TenantClient(scopes…)`,
  `Operator`, and `Authenticated` for any authenticated caller outside a tenant, C199), built from single-purpose middlewares; the tenant travels in `context.Context`,
  never a global, and every transaction applies it with `SET LOCAL` (C144).
- A module keeps all of its code in its own folder and registers its routes relative to
  its prefix (`Routes(r chi.Router)`). Only the edition package
  (`internal/edition/<name>`, C95) constructs, wires, and mounts modules, through the
  `RegisterModules` callback of `bootstrap.Run`; bootstrap builds infrastructure.
  Modules inherit the default middleware and apply authentication themselves (C92).
- Migrations live in the owning package's `migrations` folder
  (`internal/platform/<name>/migrations` or `internal/modules/<name>/migrations`), each
  with its own history table, listed in the edition's `Migrations` (platform first);
  `cmd/api`, `cmd/migrate`, `cmd/deploy`, and `cmd/seed` share the edition (C95, C122).
- Every table is audited (C164): its migration calls `audit.enable(table, exclude => …)`
  (exclude secrets and sensitive values). Open a writing transaction only with `tenant.Tx`
  (inside a tenant) or `actor.Tx` (outside one), which carry the actor for the audit; never
  `Begin` directly. A feature test fails for a table without the audit trigger.
- Migrations hold schema only, never data. Data every database needs is a seed file in
  the owning package's `seeds` folder, listed in the edition's `DataSeeders`: production
  loads it with `cmd/deploy` (migrations, then seeds; production only), development with
  `cmd/migrate` then `cmd/seed`. Other seeders are demo data, never in production (C135, C137).
- Until the first production release, a confirmed table change edits the table's
  original migration (development databases are recreated); after it, applied
  migrations never change and every change is a new migration (C140).
- Business modules may depend on platform modules; a module needing another business
  module defines the interface in its own `application` package. Platform modules never
  import business modules (C95).
- A build with fewer modules is another edition with its own mains, not build tags or
  runtime switches (C93). Editions and licensing themselves are not decided.
- Treat the documented layout as a target; create files only when an approved use case needs them.
- PostgreSQL, Redis, chi, pgx/v5 pgxpool, Goose, sqlc (C116), Ory Kratos, Ory Hydra, and Cerbos are selected;
  S3 is the object-storage API and `chipaau/minio` is the development server. See
  the decision register and ADR 0002 for exact scope. SDKs, persistence interfaces,
  transaction APIs, and provider contracts not listed there remain undecided.
- If a proposal changes an agreed boundary, explain and record the change before implementation.
- Keep audit, tracing, and caching distinct; none substitutes for another.
