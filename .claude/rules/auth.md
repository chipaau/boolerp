# Identity and authorization rules

Read [identity](../../docs/platform/identity.md) and
[authorization](../../docs/platform/authorization.md).

- Separate identity, tenant membership, and employee records.
- Ory Kratos is selected for identity/authentication, Ory Hydra (OAuth2/OpenID
  Connect) for logging in on every domain (C83), and Cerbos for authorization.
  Kratos and Hydra are integrated for the default domains (C85-C101, C112, C114,
  C126); custom-domain login, identity scope per tenant, self-hosted setup, and the
  Cerbos policies remain open. Follow the decision register and component docs
  instead of inferring those details.
- Design authentication together with verified custom domains and self-hosted operation.
- Authorization must protect application operations invoked outside HTTP as well.
- Never replace removed providers with an allow-all policy or an authentication bypass.
- Keep credentials, tokens, and private employee content out of logs, traces, and cache keys.
- Do not confuse global account disablement with tenant-specific access removal.
- Cerbos never receives a role from the `roles` table (C227): our roles are bundles of
  capabilities, and the principal carries only those capabilities, beside the fixed caller
  facts `user`, `account`, `client`, and `member`. Policies name capabilities, never roles.
- The Admin console's roles are Bool's functions (C227): Administrator, Operations, Finance,
  Support; no Viewer. Keep separation of duties: setting a tenant up, taking it live or
  billing it, and ending it are different capabilities; only Administrators manage admin users.
- Authorization (C150): Cerbos policies are static YAML; the caller's tenant capabilities
  are sent as Cerbos roles and record facts as attributes. Default to attribute-based
  rules (a derived role or condition on the caller's relationship to the record); add a
  capability only for grants with no relationship to key on, and ask the user before
  adding one. Every tenant resource policy checks the tenant; no code path bypasses
  Cerbos, the operator included; any Cerbos or adapter failure denies.

