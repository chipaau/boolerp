# Product scope

Status: confirmed requirements and current scope, 2026-09-26.

## Product requirements

- Bool ERP serves organizations in the Maldives.
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

Frontend integration is deferred. Existing frontends may remain in the repository
and `app` stays in the development Compose configuration, but neither determines
the new API contract or blocks backend progress.

## Current implementation boundary

On 2026-09-26, the user authorized renaming the previous API to `apps/api.bak`,
creating the proposed directory structure, and adding a simple API entry point.
The initial layer is a standard-library HTTP server with a liveness endpoint.

This does not approve employee tables, identity/authorization providers, database
migrations, or frontend integration. Empty directories reserve the proposed
boundaries; they are not implemented platform capabilities. Continue layer by layer.

See the [decision register](../decisions/README.md) and [roadmap](../roadmap.md).
