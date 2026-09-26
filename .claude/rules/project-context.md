# Project context rules

The active scope is documented in [product/scope.md](../../docs/product/scope.md)
and [ADR 0001](../../docs/adr/0001-api-rebuild.md).

- Treat the API as a fresh implementation in the existing monorepo.
- The previous API is archived at `apps/api.bak/`; leave it out of new-API builds
  and do not modify or execute its migrations without an explicit request.
- Do not derive new schemas, routes, provider choices, or business behavior from the
  previous API or sibling repositories unless explicitly asked to research them.
- Focus on the platform backbone and HRMS employee records only.
- Defer frontend integration; frontend code is not the contract for the new API.
- Preserve SaaS and self-hosted requirements in design without inventing deployment
  or licensing decisions that have not been confirmed.
- Use the [roadmap](../../docs/roadmap.md) to keep work sequential and bounded.

The canonical checkout is `/Users/chipaau/code/bool/erp`, with the GitHub remote
`git@github.com:boolmv/erp.git`. The sibling `go-erp` checkout is not the active
workspace. See [repository transfer](../../docs/repository-transfer.md) before
recovering saved security-review work or changing branches.
