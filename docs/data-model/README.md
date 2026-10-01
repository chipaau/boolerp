# Data model status

Updated: 2026-10-01.
Status: open. One table is approved and implemented: `users` (below). (A `sessions`
table was approved for sessions in PostgreSQL and withdrawn when sessions moved to the
BFF's Redis, C90.)

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

### `users` (identity module, C94)

Approved 2026-10-01 by the user, with `phone`. One row per person who has a Kratos
identity and has used the platform; it is the API's own key for a person, so other
tables reference `users.id`, never the Kratos identity ID. It is not tenant-scoped:
tenant membership and employee records are separate tables (identity rules), and some users
(such as FindCare's public users) never become members.

| Column | Type | Rule |
| --- | --- | --- |
| `id` | `uuid` | Primary key, `uuidv7()` default. |
| `kratos_identity_id` | `uuid` | Not null, unique; the Kratos identity the user belongs to. |
| `email` | `text` | Not null; a copy of the identity's login email trait. |
| `phone` | `text` | Not null; a copy of the identity's phone trait. |
| `display_name` | `text` | Nullable; a copy of the identity's name trait. |
| `created_at`, `updated_at` | `timestamptz` | Not null, `now()` defaults; `updated_at` set on every sync. |

Kratos stays the authority for the copied traits; the identity module writes the row
when Kratos's registration web hook calls it and on a person's first authenticated
request, and refreshes the copy on every sync. `email`, `phone`, and `display_name`
are personal data: never logged, cached, or traced. The migration is
`apps/api/internal/modules/identity/migrations/00001_users.sql`.

See [tenancy](../platform/tenancy.md), [HRMS employees](../hrms/employees.md),
and [the decision register](../decisions/README.md).
