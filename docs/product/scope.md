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

Build the API from scratch. The previous API's schemas, libraries, providers,
endpoints, and implementation status are not design constraints.

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

On 2026-09-26, the user authorized setting the previous API aside,
creating the proposed directory structure, and adding a simple API entry point.
The initial layer is a standard-library HTTP server with a liveness endpoint.

The user subsequently authorized platform delivery step 1. Runtime environment
configuration, validation, structured logging, redaction, and explicit dependency
wiring are implemented; see [development](../development.md).

On 2026-09-27, the user authorized platform step 2 on a new branch from `dev`.
The [HTTP foundation](../platform/http.md) is implemented; liveness remains the
only public operation.

On 2026-09-28 the user removed that implementation to rebuild the API from
scratch, starting with a simple chi server, then configuration, then logging (C24).

Since then the API has been rebuilt layer by layer: the foundations, identity, and
the first tables (`users`, `countries`); the [roadmap](../roadmap.md) has the status.
Employee tables are not approved yet, and each table's fields are confirmed before it
is created (C121).

See the [decision register](../decisions/README.md) and [roadmap](../roadmap.md).
