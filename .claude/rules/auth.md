# Identity and authorization rules

Read [identity](../../docs/platform/identity.md) and
[authorization](../../docs/platform/authorization.md).

- Separate identity, tenant membership, and employee records.
- Authentication and authorization providers are not selected for the rebuild.
  Do not reinstate previous provider services or dependencies without a recorded decision.
- Design authentication together with verified custom domains and self-hosted operation.
- Authorization must protect application operations invoked outside HTTP as well.
- Never replace removed providers with an allow-all policy or an authentication bypass.
- Keep credentials, tokens, and private employee content out of logs, traces, and cache keys.
- Do not confuse global account disablement with tenant-specific access removal.
