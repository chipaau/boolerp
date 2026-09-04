# app — the ERP application

React + TanStack Router (Vite SPA) + shadcn/ui (Base UI). Served per tenant subdomain
(`<tenant>.bool.test` in dev) behind the shared Traefik proxy; embedded in the Go binary for
self-host. Everything runs in Docker (`docker compose up`), never with host Node.

- `src/routes` — file-based routes. `_app` is the signed-in shell (session guard + header);
  `_app/$app/*` serves every business app from the registry in `src/lib/apps.ts`.
- `src/features/<feature>` — screens, pure logic, TanStack Query hooks and (for now) fixtures.
  See `src/features/README.md` for the layout and how fixtures are removed at integration.
- `src/proto` — placeholder pages for sections without a real screen yet. Deleted when done.
- `src/components/layout` — the shell chrome (topbar, rail, menus).
- UI primitives come from `@workspace/ui`; Kratos auth screens from `@workspace/auth`.

```bash
docker compose exec app pnpm --filter app lint
docker compose exec app sh -c 'cd apps/app && pnpm exec tsc --noEmit -p .'
```
