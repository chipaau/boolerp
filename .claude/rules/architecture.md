# Architecture rules

Read [architecture/backend.md](../../docs/architecture/backend.md) and
[architecture/request-lifecycle.md](../../docs/architecture/request-lifecycle.md).

- Keep domain and application logic independent of HTTP frameworks, database drivers,
  generated persistence models, cache clients, and external provider SDKs.
- Put external implementations in adapters and dependency construction in bootstrap.
- `internal/platform/` holds everything that is not a business app (C122): technical
  infrastructure (config, postgres, redis, http) and the platform capabilities that own
  tables (identity, reference, tenancy, authorization, audit). `internal/modules/` holds
  business apps only (HRMS, inventory, …).
- A module owns its persistence writes. Do not reach into another module's SQL package.
- A module keeps all of its code in its own folder and registers its routes relative to
  its prefix (`Routes(r chi.Router)`). Only the edition package
  (`internal/edition/<name>`, C95) constructs, wires, and mounts modules, through the
  `RegisterModules` callback of `bootstrap.Run`; bootstrap builds infrastructure.
  Modules inherit the default middleware and apply authentication themselves (C92).
- Migrations live in the owning package's `migrations` folder
  (`internal/platform/<name>/migrations` or `internal/modules/<name>/migrations`), each
  with its own history table, listed in the edition's `Migrations` (platform first);
  `cmd/api` and `cmd/migrate` share the edition (C95, C122).
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
