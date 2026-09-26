# Frontend scope

Frontend integration is deferred. See [product scope](../../docs/product/scope.md)
and [development](../../docs/development.md).

- Do not inspect or modify frontend application code as a prerequisite for backend design.
- Keeping `app` in Compose does not make frontend integration part of the current task.
- Do not generate clients, change routes, or embed frontend assets until that work is requested.
- Documentation and instruction-file relocation is allowed when documentation organization
  is explicitly requested; it does not authorize application changes.
- Preserve the newer frontend source and shared packages from `develop`; do not copy
  frontend code from the older `go-erp` checkout.
- Future frontend work should retain the existing React/TanStack Router and shared
  `@workspace/ui` conventions unless a change is explicitly agreed.
