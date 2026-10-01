# Architecture rules

Read [architecture/backend.md](../../docs/architecture/backend.md) and
[architecture/request-lifecycle.md](../../docs/architecture/request-lifecycle.md).

- Keep domain and application logic independent of HTTP frameworks, database drivers,
  generated persistence models, cache clients, and external provider SDKs.
- Put external implementations in adapters and dependency construction in bootstrap.
- Keep infrastructure under `internal/platform/`; keep policy-bearing capabilities
  under `internal/modules/`.
- A module owns its persistence writes. Do not reach into another module's SQL package.
- A module keeps all of its code in its own folder and registers its routes relative to
  its prefix (`Routes(r chi.Router)`). Only the build's `main` constructs and mounts
  modules (the `RegisterModules` callback of `bootstrap.Run`); bootstrap builds infrastructure.
  Modules inherit the default middleware and apply authentication themselves (C92).
- A build with fewer modules is another `main` listing fewer, not build tags or runtime
  switches (C93). Editions and licensing themselves are not decided.
- Treat the documented layout as a target; create files only when an approved use case needs them.
- PostgreSQL, Redis, chi, pgx/v5 pgxpool, Goose, Ory Kratos, Ory Hydra, and Cerbos are selected;
  S3 is the object-storage API and `chipaau/minio` is the development server. See
  the decision register and ADR 0002 for exact scope. SDKs, persistence interfaces,
  transaction APIs, and provider contracts not listed there remain undecided.
- If a proposal changes an agreed boundary, explain and record the change before implementation.
- Keep audit, tracing, and caching distinct; none substitutes for another.
