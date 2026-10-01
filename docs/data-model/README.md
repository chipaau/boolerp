# Data model status

Updated: 2026-10-01.
Status: open. One platform table is approved; no module tables yet.

The previous foundation DDL and wider schemas are archived. They are not a starting
schema, and their old approval labels do not apply to this rebuild.

Review each required table with its purpose, ownership, columns/types, keys,
constraints, tenant scope, relationships, lifecycle, sensitive fields, and
relevant concurrency requirements. Record explicit approval before writing
migrations or queries against that table.

Tenant semantics and the isolation model must be settled before approving
tenant-scoped employee persistence. UUID versions, identifier formats, soft
deletion, hierarchy storage, bilingual fields, and identity linkage are not
automatically inherited.

## Approved tables

| Table | Approved | Purpose and design |
| --- | --- | --- |
| `sessions` | 2026-10-01 (C90) | Browser sessions of the backend-for-frontend service, in the layout of `scs`'s `pgxstore`: `token text PRIMARY KEY` (the SHA-256 hash of the cookie's random token, `HashTokenInStore`), `data bytea NOT NULL` (the session contents, encoded by `scs`), `expiry timestamptz NOT NULL`, index on `expiry`. Owned by the BFF; not tenant-scoped (a session belongs to a person); expired rows are deleted by the store. Sensitive: `data` holds the ID token and, encrypted, Hydra's access and refresh tokens (C90); the encryption is settled in 7c-2. |

See [tenancy](../platform/tenancy.md), [HRMS employees](../hrms/employees.md),
and [the decision register](../decisions/README.md).
