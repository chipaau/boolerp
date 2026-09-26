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
- PostgreSQL and Redis are selected. Specific libraries, persistence interfaces,
  transaction APIs, and provider engines remain subject to the decision register.
- If a proposal changes an agreed boundary, explain and record the change before implementation.
- Keep audit, tracing, and caching distinct; none substitutes for another.
