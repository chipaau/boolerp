# Monorepo rules

Read [development.md](../../docs/development.md).

- The new backend belongs in `apps/api/`, with its own Go module.
- Product and engineering documentation lives only under `docs/`.
- Agent rules live under `.claude/`; keep agent entry-point files as links.
- The current Compose service set is exactly `api`, `app`, `postgres`, and `redis`.
  Keep required networking and data volumes; do not add services incidentally.
- Preserve existing application source and database contents unless their migration,
  archival, or removal is part of an explicitly authorized task.
- Use Docker for language tooling. Repository inspection and documentation validation
  do not require starting application services.
