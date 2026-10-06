# Authorization

Status: required backbone capability; Cerbos is selected as the policy engine. The
role and assignment tables are designed (C116), see
[tenancy](tenancy.md#approved-table-designs-c116), and roles are per app (step 8). Built:
the `apps` catalogue, mirrored from code (C165), and `tenant_apps`, which apps each tenant
has on, turned on and off by the operator (C166), and `roles`, one app each, global (from
code) or a tenant's own (C167), and `capabilities`, mirrored from code (C168), `role_capabilities` (C169), and `role_assignments`, on memberships (C170). Next: capabilities
in the principal, the `Operator` chain, and the first operator route.

## Required boundary

Authorization belongs in the application execution path for employee operations.
HTTP middleware and frontend visibility checks alone are insufficient. Future jobs
and integrations must receive equivalent tenant and access protections.

Identity, active tenant membership, operation permission, and record visibility are
separate checks. Removing access in one tenant must have deliberately defined
effects on memberships and sessions elsewhere.

## Open decisions

Decided: Cerbos as the policy engine (C21); the role, capability, and assignment
tables (C116); Cerbos as its own service with YAML policies tested in CI (C149); static
policies with tenant capabilities sent as Cerbos roles and record facts as attributes,
attribute-based rules by default, no bypass for the operator, and a tenant check in every
tenant resource policy (C150); policies inside each module with tests and attribute schemas, missing attributes denied (C151); gRPC through `cerbos-sdk-go`, and the `cerbos` Compose service (C152); capabilities named `<module>:<resource>:<level>` and the first policy, `tenancy:tenant` (C153); `identity:user` and `identity:client` for callers outside a tenant, with the `user` and `client` roles (C154). Built: the authorization port (`Check`, `Can`, facts), the Cerbos adapter over gRPC, the record-or-deny backstop (`Enforce`), and `/me` as the first protected route (C155). Built: the `authorization` platform module (the shared principal schema, the policy assembly), `cmd/policies`, the `policies` Compose step, and CI's `api-policies` job. Still open:

- The Cerbos policies, record-level scope, and permission administration.
- The Cerbos SDK and the sources of trusted principal/resource attributes.
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
