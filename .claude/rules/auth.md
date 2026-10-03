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
