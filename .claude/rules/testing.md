# Testing standard

**No use case reaches ✅ Implemented until it is fully tested.** Every `UC-<AREA>-<n>` in the SRS maps
to named tests; the component's checklist Definition-of-Done lists them.

## Layers (every user-facing use case needs all three)
- **Unit** — Go stdlib `testing` + testify; table-driven; pure logic and edge cases.
- **Integration** — real Postgres via **Testcontainers**; each test runs in a transaction that
  **rolls back** (Laravel-`DatabaseTransactions` style). Exercises `WithTenant`/RLS, sqlc queries,
  Kratos (`whoami`) and Cerbos decisions against real services where feasible.
- **E2E** — **Playwright** against the running compose stack; drives `apps/app` and `apps/admin`
  through each user-facing use case (login, MFA, OIDC, provisioning, impersonation, …).

## Coverage
- **100% of use cases covered** (unit + integration + e2e). Critical paths — authentication, tenancy
  isolation, authorization, audit — at full coverage. Coverage tracked in CI; CI fails on regressions.
- Interpreted at the **use-case level** (every UC tested end-to-end), not as a line-count gate on
  generated/plumbing code. *(Confirm if a hard global line-coverage gate is intended instead.)*

## Mandatory tenancy tests
- Every tenant-scoped feature has a **cross-tenant isolation test**: a second tenant's data must be
  invisible/unwritable — proving RLS + `WithTenant`. Ties to the RLS coverage guard (UC-FND-06).

## CI
- Every PR runs unit + integration (Testcontainers) + e2e (Playwright). Green is required to merge.
- Traceability: tests reference their `UC-` id so coverage of the spec is auditable.
