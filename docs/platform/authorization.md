# Authorization

Status: required backbone capability; permission model and engine open.

## Required boundary

Authorization belongs in the application execution path for employee operations.
HTTP middleware and frontend visibility checks alone are insufficient. Future jobs
and integrations must receive equivalent tenant and access protections.

Identity, active tenant membership, operation permission, and record visibility are
separate checks. Removing access in one tenant must have deliberately defined
effects on memberships and sessions elsewhere.

## Open decisions

- Roles, permissions, record-level scope, and permission administration.
- Policy engine versus an in-process implementation.
- Sources of trusted principal/resource attributes.
- Operator/support access and whether elevated actions require additional approval.
- Revocation timing and consistency if any access-related data is cached.
- What evidence to audit for denied actions.

## Proposed architecture

HRMS application operations consume a small authorization port. Its implementation
belongs to the authorization capability and its adapters; HRMS domain code does
not import a policy SDK.

Denied or unavailable authorization must not become an allow-all fallback.
Cache keys and lookup paths must never let another caller's broader visibility
authorize a request. Exact failure responses and policy contracts remain open.

See [identity](identity.md), [tenancy](tenancy.md), [audit](audit.md), and [caching](caching.md).
