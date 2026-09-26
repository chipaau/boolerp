# Tenancy, memberships, and domains

Status: multi-tenant SaaS and verified domains required; tenant semantics and isolation open.

## Next decision

Does one licensed customer operate one tenant or multiple tenants? Does a tenant
represent an organization, a legal entity, or another access/data boundary?
Hierarchy, parent visibility, and self-hosted tenant limits are not yet selected.

Licensing scope, identity, tenant membership, and an employee's data ownership are
different concepts. Their relationship needs explicit agreement.

## Domain requirements

Support default domains such as `cyryx.bool.mv` and verified custom domains such as
`app.cyryx.mv` or `cyryx.mv`. Hostnames route requests; they do not prove access.

The design must address normalized hostname lookup, ownership verification,
activation/revocation, trusted proxy headers, TLS, redirect validation, and
unknown/unverified hosts. The registry and its lifecycle are not approved schemas.

## Proposed isolation

Pooled PostgreSQL tables with tenant_id, RLS, a non-owner runtime role, and
tenant-aware foreign keys are the current recommendation, not a confirmed decision.
Control-plane lookup permissions need a separate, narrow design.

If selected, tenant scope must apply to reads, writes, jobs, caches, and audit queries.
Use transaction-local database settings; test missing scope and pooled connection reuse.

Read visibility and mutation policies must be separate: broad descendant visibility
must not authorize descendant updates or deletes. WITH CHECK does not protect
DELETE operations. Aggregate-only access must not expose unrestricted detail reads.
See [PostgreSQL policy semantics](https://www.postgresql.org/docs/18/sql-createpolicy.html).

No historical schema-per-tenant, hierarchy, or visible-set design is inherited.
See [identity](identity.md), [authorization](authorization.md), and [deployment](deployment.md).
