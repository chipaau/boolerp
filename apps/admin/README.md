# admin — the operator console

React + TanStack Router (Vite SPA) + shadcn/ui, single origin `admin.bool.test`, internal only.
Shares `@workspace/ui` and `@workspace/auth` with `apps/app`; calls the gated `/api/v1/admin/*`
route group on the same Go API. Currently a session-guarded shell; provisioning, suspension and
support tooling arrive with the tenant-management and authorization components.

```bash
docker compose exec admin pnpm --filter admin lint
```
