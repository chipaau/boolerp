# Product scope

Status: confirmed requirements and current scope, 2026-09-26.

## Product requirements

- Bool ERP serves organisations in any country, starting with the Maldives. Nothing is
  limited to one country: country-specific rules (legal forms, identity documents,
  addresses, phone formats, time zones) are data per country, never assumptions in code
  or defaults.
- The backend is Go, developed within the existing monorepo.
- The UI is English. Dhivehi is supported as content where needed; a Dhivehi UI,
  automatic language selection, and universally required bilingual fields are not requirements.
- Hosted SaaS supports multiple tenants.
- Default customer domains include `cyryx.bool.mv`.
- Verified custom domains include `app.cyryx.mv` and `cyryx.mv`.
- Self-hosting uses the same codebase and release, normally for one licensed customer.
  The number of tenants permitted within that customer is still open.
- Backend distribution supports binaries or containers. Licensing should discourage
  unauthorized resale, with no claim that customer-controlled binaries are tamper-proof.
- Workspace, public-portal, and integration entry points should share business
  operations when those surfaces are implemented.

## Current implementation scope

Earlier implementations' schemas, libraries, providers, endpoints, and
implementation status are not design constraints.

Focus on the platform backbone: identity/authentication, tenancy and domains,
authorization, audit, tracing/logging, caching, transactions, background-work
boundaries, configuration, and deployment foundations.

HRMS employee records are the only business functionality in the current scope.
Their fields, tables, lifecycle, and concrete operations are not yet approved.
Employee examples demonstrate the architecture rather than define a schema.

Frontend integration has started (C128): the apps sign in through their BFFs, are
built from workspace packages and editions, and have end-to-end tests. Its standards
are not set yet: the business API contract and client generation, the data layer, and
the scope of browser tests. The frontend does not determine the new API contract or
block backend progress.

## Current implementation boundary

The API is built layer by layer (C24): the HTTP, configuration, logging, PostgreSQL,
Redis, and observability foundations, identity, and the first tables (`users`,
`countries`); the [roadmap](../roadmap.md) has the status. Employee tables are not
approved yet, and each table's fields are confirmed before it is created (C121).

See the [decision register](../decisions/README.md) and [roadmap](../roadmap.md).
