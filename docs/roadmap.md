# Sequential roadmap

Updated: 2026-09-26.

This is an implementation sequence, not approval to implement all steps.
Resolve one decision at a time using the [decision register](decisions/README.md).

| Stage | Outcome | Current status |
| --- | --- | --- |
| 0. Documentation baseline | Fresh branch, current scope/decisions, archived history, centralized agent rules, four-service Compose | Documentation/configuration milestone; no new application implementation |
| 0a. Executable scaffold | Preserve apps/api.bak; create target directories, main, bootstrap, HTTP lifecycle, and a liveness endpoint | Verified in Docker: build, formatting, vet, liveness, graceful shutdown, invalid-port failure, and standalone image build |
| 1. Tenant model | Agree what a tenant represents and its relationship to a licensed customer | Next discussion, D01 |
| 2. Isolation and persistence | Confirm data boundary, application ports, transaction approach, and candidate Go libraries | Open |
| 3. Identity and authorization | Decide domain-aware login, memberships, permissions, providers, and revocation | Open |
| 4. Operational contracts | Specify audit, tracing, Redis cache behavior, and required background execution | Open |
| 5. First schema and foundation | Extend the minimal executable with approved configuration, persistence, migrations, and meaningful tests; approve tables individually | Initial executable scaffold exists; remaining foundation not started |
| 6. Employee operation | Implement one approved employee operation through domain/application/adapters, including access, audit, and trace | Not started |
| 7. Cache-backed employee read | Prove scoped Redis caching, invalidation, and failure behavior for a concrete read | Not started |
| 8. Deployment proof | Verify installation, same-release SaaS/self-host behavior, licensing, upgrades, and restore | Open design; implementation not started |
| 9. Frontend integration | Define/generate client contract, connect frontend, add browser validation, package assets as agreed | Deferred |

Deployment constraints inform earlier choices; postponing implementation does not
mean ignoring custom-domain or self-host requirements during identity design.

## Build layer by layer

1. **Executable and HTTP shell:** current scaffold; liveness only, no application operations.
2. **Runtime configuration and logging:** agree configuration/error contracts and
   structured logging before expanding startup behavior.
3. **PostgreSQL and Redis infrastructure:** select clients and define connection,
   timeout, and readiness behavior without creating unapproved tables.
4. **Identity, tenancy, and authorization:** settle their model decisions one at
   a time, then enforce the application execution boundary.
5. **Transactions, audit, tracing, and caching:** implement the approved contracts
   and their integration checks; keep these capabilities distinct.
6. **Employee domain, application, and adapters:** approve the employee model and
   implement one complete operation before expanding its API.

The previous API is preserved in `apps/api.bak`. It is not a source of inherited
implementation decisions, and its migrations must not be used for the new API.
Keep existing databases intact unless a separate data migration/reset is authorized.

Do not expand the business scope beyond employee records or build a generic
framework before the first complete operation proves the backbone.
