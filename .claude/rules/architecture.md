# Architecture rules

Read [architecture/backend.md](../../docs/architecture/backend.md) and
[architecture/request-lifecycle.md](../../docs/architecture/request-lifecycle.md).

- Keep domain and application logic independent of HTTP frameworks, database drivers,
  generated persistence models, cache clients, and external provider SDKs.
- Put external implementations in adapters and dependency construction in bootstrap.
- Keep infrastructure under `internal/platform/`; keep policy-bearing capabilities
  under `internal/modules/`.
- A module owns its persistence writes. Do not reach into another module's SQL package.
- Treat the documented layout as a target; create files only when an approved use case needs them.
- PostgreSQL, Redis, chi, pgx/v5 pgxpool, Goose, Ory Kratos, and Cerbos are selected;
  S3 is the object-storage API and `chipaau/minio` is the development server. See
  the decision register and ADR 0002 for exact scope. SDKs, persistence interfaces,
  transaction APIs, and provider contracts not listed there remain undecided.
- If a proposal changes an agreed boundary, explain and record the change before implementation.
- Keep audit, tracing, and caching distinct; none substitutes for another.
