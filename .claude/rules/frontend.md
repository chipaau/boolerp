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
  members' work: do not modify or delete it, including `packages/auth` and `e2e/`.
- New identity work (`apps/identity`, C84) does not use `packages/auth`, which targets
  the previous Kratos design (`/auth` on each tenant domain).
- Internal applications (`apps/app`, `apps/admin`) use React with Vite and TanStack
  Router; the Go API is their backend-for-frontend (C88). Public-facing applications,
  reached by people outside a customer's staff (`apps/website`, `apps/identity`, later
  FindCare's public side), use Next.js (C87). All apps share `@workspace/ui` and
  `@workspace/assets`; other changes to these conventions need explicit agreement.
