# Authorization

Status: required backbone capability; Cerbos is selected as the policy engine. The
role and assignment tables are designed (C116), see
[tenancy](tenancy.md#approved-table-designs-c116), and roles are per app (step 8). Built:
the `apps` catalogue, mirrored from code (C165), and `tenant_apps`, which apps each tenant
has on, turned on and off by the operator (C166), both tenancy's since C206 (authorization
reads `tenant_apps` through tenancy's view `tenant_apps_on`); and `roles`, one app each, global (from
code) or a tenant's own (C167), and `capabilities`, mirrored from code (C168), `role_capabilities` (C169), and `role_assignments`, on memberships (C170); the
admin console's global roles (`admin.administrator`, `admin.viewer`) mirrored from code, the
team's Administrator role seeded, and the caller's capabilities loaded per request and sent
to Cerbos as roles (C177); the `Operator` chain (C178) and `GET /api/v1/tenants` (C179).

## The Admin console's roles (C227)

Cerbos never receives a role from the `roles` table. A role is a bundle of capabilities; the
principal carries the capabilities the caller's roles grant, beside the fixed caller facts
`user`, `account`, `client`, and `member`, and policies name capabilities only.

The Admin console's global roles are Bool's functions, with separation of duties:

| Role | Function | Can | Cannot |
| --- | --- | --- | --- |
| Administrator | platform owners | everything, including admin users and archiving a tenant | |
| Operations | setting tenants up | create a tenant; set its details, address, apps, and first Control Centre administrators (C228) | take it live, suspend, archive; finance |
| Finance | invoicing and payments | billing and dunning; take a tenant live, suspend for non-payment, reactivate | change setup or administrators; archive |
| Support | helping customers | see tenants and their setup, resend invitations and set-password links, read the audit trail | any change |

There is no Viewer role (`admin.viewer` goes). The tenant capabilities follow the duties:
`tenancy:tenant:view`, `:manage` (create and set up), `:activate`, `:suspend` (with
reactivate), `:archive`. Administrator and Operations are built first; Finance and Support
come with their screens.

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
