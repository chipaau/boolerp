# Monorepo rules

Read [development.md](../../docs/development.md).

- The new backend belongs in `apps/api/`, with its own Go module.
- Product and engineering documentation lives only under `docs/`.
- Agent rules live under `.claude/`; keep agent entry-point files as links.
- Compose started with `api`, `app` (now `workspace`, C108), `postgres`, and `redis`
  (C08); that is not a limit. Add a service deliberately when a step needs it, and record why. Keep
  required networking and data volumes.
- Preserve existing application source and database contents unless their migration,
  archival, or removal is part of an explicitly authorized task.
- Use Docker for language tooling. Repository inspection and documentation validation
  do not require starting application services.
