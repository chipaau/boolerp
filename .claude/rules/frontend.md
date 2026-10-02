# Frontend scope

Frontend integration is deferred. See [product scope](../../docs/product/scope.md)
and [development](../../docs/development.md).

- Do not inspect or modify frontend application code as a prerequisite for backend design.
- Keeping `app` in Compose does not make frontend integration part of the current task.
- Do not generate clients, change routes, or embed frontend assets until that work is requested.
- Documentation and instruction-file relocation is allowed when documentation organization
  is explicitly requested; it does not authorize application changes.
- Preserve the newer frontend source and shared packages from `develop`; do not copy
  frontend code from the older `go-erp` checkout. The frontend is other team
  members' work: do not modify or delete it, including `e2e/`, unless the user asks for
  a specific change (as for removing `packages/auth`, C100).
- `apps/workspace` and `apps/admin` sign in only through their BFF, following
  [app integration](../../docs/platform/bff-frontend.md): no Kratos or Hydra calls and no
  tokens in the browser. `packages/auth` (the previous design) was removed (C100).
- Read [frontend structure](../../docs/architecture/frontend.md). Workspace apps (Control
  Centre, HRMS, Tasks, Inventory, …) are packages `packages/app-<slug>` with a `defineApp`
  manifest (a permission per page) and file routes mounted by the shell's edition (C102);
  apps never import each other or the shell; shared data is a platform package such as
  `@workspace/org` (C106). Inside an app: `features/<feature>/` and thin routes.
- Internal applications (`apps/workspace`, `apps/admin`) use React with Vite and TanStack
  Router; each is embedded in and served by its backend-for-frontend service
  (`bff-workspace`, `bff-admin`, C90, ADR 0003). Public-facing applications,
  reached by people outside a customer's staff (`apps/website`, `apps/identity`, later
  FindCare's public side), use Next.js (C87). All apps share `@workspace/ui` and
  `@workspace/assets`; other changes to these conventions need explicit agreement.
