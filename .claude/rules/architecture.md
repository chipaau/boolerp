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
  `Operator`), built from single-purpose middlewares; the tenant travels in `context.Context`,
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
  (exclude secrets and sensitive values), and every transaction that writes applies the
  actor (`tenant.Tx` does; other writers call `actor.Apply`). A feature test fails for a
  table without the audit trigger.
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
