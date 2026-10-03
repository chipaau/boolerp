# Data model status

Updated: 2026-10-03.
Status: open. Two tables are confirmed and implemented: `users` and `countries` (below). (A `sessions`
table was approved for sessions in PostgreSQL and withdrawn when sessions moved to the
BFF's Redis, C90.)

## Diagram

[`erd.dbml`](erd.dbml) is the entity-relationship diagram in DBML: open
[dbdiagram.io](https://dbdiagram.io) and paste it in (or import the file) to see it.

**A table appears in the diagram, and gets a migration, only after the user has
explicitly confirmed its fields; the same applies to every modification.** Each table
is proposed on its own, showing `Column | Type | Constraints / default | Current |
Proposed`, so the whole table is seen before and after; approving a design or an
approach is not field confirmation. The confirmation is recorded below, and the diagram
and migration are added in the same change. Partial indexes, CHECK constraints,
triggers, and row-level security are summarised in notes, since DBML cannot express
them. To check the diagram parses:

```sh
docker run --rm -v "$PWD/docs/data-model:/d" -w /d node:26-alpine \
  npx -y -p @dbml/cli@10.2.0 dbml2sql erd.dbml --postgres -o /tmp/erd.sql
```

The previous foundation DDL and wider schemas are archived. They are not a starting
schema, and their old approval labels do not apply to the current design.

Review each required table with its purpose, ownership, columns/types, keys,
constraints, tenant scope, relationships, lifecycle, sensitive fields, and
relevant concurrency requirements. Record explicit approval before writing
migrations or queries against that table.

Tenant semantics and the isolation model must be settled before approving
tenant-scoped employee persistence. UUID versions, identifier formats, soft
deletion, hierarchy storage, bilingual fields, and identity linkage are not
automatically inherited.

## Approved tables

### `countries` (platform reference data, C120, C122)

Fields confirmed 2026-10-03 by the user, with alpha-3 added at their question; meaning
changed 2026-10-04 (C135), columns unchanged. The ISO 3166-1 countries and territories;
legal forms and tenants will reference `code`, and a country is offered when it has
legal forms. Global reference data, not tenant-scoped.

| Column | Type | Rule |
| --- | --- | --- |
| `code` | `char(2)` | Primary key; ISO 3166-1 alpha-2 (`MV`); CHECK `^[A-Z]{2}$`. |
| `alpha3` | `char(3)` | Not null, unique; ISO 3166-1 alpha-3 (`MDV`); CHECK `^[A-Z]{3}$`. |
| `name` | `text` | Not null, not blank; English (`Maldives`). |
| `phone_prefix` | `text` | Not null; CHECK `^\+[0-9]{1,4}$` (`+960`). |
| `active_from` | `timestamptz` | Not null, `now()` default: when the code entered the ISO list. |
| `active_to` | `timestamptz` | Nullable: when ISO withdrew the code (null = current); not before `active_from`. |
| `created_at`, `updated_at` | `timestamptz` | Not null, `now()` defaults; `updated_at` set by a trigger on every update. |

The migration holds the schema only; the 249 rows come from the seed file
`apps/api/internal/platform/reference/seeds/countries.csv` (public-domain
[datasets/country-codes](https://github.com/datasets/country-codes)), loaded by
`cmd/deploy` (C135). Row-level security is enabled: everyone reads; there is
no write policy until the operator rule exists, so the runtime role cannot change
countries; only the migration role (migrations and `cmd/deploy`) does. The migration is
`apps/api/internal/platform/reference/migrations/00001_countries.sql`.

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
on a person's first authenticated request (C94). `email`, `phone`, and `display_name`
are personal data: never logged, cached, or traced. The migration is
`apps/api/internal/platform/identity/migrations/00001_users.sql`.

See [tenancy](../platform/tenancy.md), [HRMS employees](../hrms/employees.md),
and [the decision register](../decisions/README.md).
