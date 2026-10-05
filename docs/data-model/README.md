# Data model status

Updated: 2026-10-05.
Status: open. Confirmed and implemented: `users`, `countries`, `legal_forms`, `sectors`,
`institution_types`, `tenants`, `tenant_institution_types`, and `domains` (below). (A `sessions`
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
`cmd/deploy` in production and `cmd/seed` in development (C135, C137). Row-level security is enabled: everyone reads; there is
no write policy until the operator rule exists, so the runtime role cannot change
countries; only the migration role (migrations, `cmd/deploy`, `cmd/seed`) does. The migration is
`apps/api/internal/platform/reference/migrations/00001_countries.sql`.

### `users` (identity module, C94)

Approved 2026-10-01 by the user, with `phone`; `avatar_url` confirmed 2026-10-05 by the
user, with the Kratos `picture` trait it copies. One row per person who has a Kratos
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
| `avatar_url` | `text` | Nullable; a copy of the identity's picture trait (filled from Google's `picture` claim). Check: starts with `http://` or `https://` and is not blank. |
| `created_at`, `updated_at` | `timestamptz` | Not null, `now()` defaults; `updated_at` set on every registration. |

Kratos stays the authority for the copied traits; the identity module writes the row
only when the person registers (`POST /api/auth/me` with their access token, from
Hydra's `/userinfo`, C157), never as a side effect of another request. `email`, `phone`, `display_name`, and
`avatar_url` are personal data: never logged, cached, or traced. The migration is
`apps/api/internal/platform/identity/migrations/00001_users.sql`.

See [tenancy](../platform/tenancy.md), [HRMS employees](../hrms/employees.md),
and [the decision register](../decisions/README.md).

### `legal_forms` (platform reference data, C120, C136)

Fields confirmed 2026-10-04 by the user, with the seed rows and their categories. What an
organisation is in law, per country; a tenant picks one of its own country's. Global
reference data, not tenant-scoped.

| Column | Type | Rule |
| --- | --- | --- |
| `id` | `uuid` | Primary key, `uuidv7()` default. |
| `country` | `char(2)` | Not null; references `countries.code`, `ON DELETE RESTRICT`. |
| `code` | `text` | Not null; CHECK `^[a-z][a-z0-9_]{1,49}$`; unique with `country`. |
| `name` | `text` | Not null, not blank. |
| `category` | `text` | Not null; one of `government`, `private`, `non_profit`, `international`: what cross-country rules attach to. |
| `identity_document` | `text` | Nullable: the registration number its organisations carry; null = none; not blank. |
| `active_from` | `timestamptz` | Not null, `now()` default. |
| `active_to` | `timestamptz` | Nullable: retired; null = offered; not before `active_from`. |
| `created_at`, `updated_at` | `timestamptz` | Not null, `now()` defaults; `updated_at` set by a trigger on every update. |

The migration holds the schema only; the rows come from
`apps/api/internal/platform/reference/seeds/legal_forms.csv` (the Maldives' 12), loaded
by `cmd/deploy` and `cmd/seed` after the countries (C135, C137).
Change confirmed 2026-10-04: a unique constraint on `(id, country)`
(in `00002_legal_forms.sql`), the target of `tenants`' two-column foreign key. Row-level security as for `countries`:
everyone reads; only the migration role writes until the operator rule exists. The
migration is `apps/api/internal/platform/reference/migrations/00002_legal_forms.sql`.

### `sectors` (platform reference data, C120, C136)

Fields and seed rows confirmed 2026-10-04 by the user, with "Trade and industry" split
into trade, manufacturing, construction, and agriculture and fisheries, and professional
services added, following ISIC's sections. The broad field an organisation works in;
`institution_types` refine each. Global, not tenant-scoped.

| Column | Type | Rule |
| --- | --- | --- |
| `code` | `text` | Primary key; CHECK `^[a-z][a-z0-9_]{1,49}$` (`health`). A global, stable code, so no UUID. |
| `name` | `text` | Not null, not blank. |
| `active_from` | `timestamptz` | Not null, `now()` default. |
| `active_to` | `timestamptz` | Nullable: retired; null = in use; not before `active_from`. |
| `created_at`, `updated_at` | `timestamptz` | Not null, `now()` defaults; `updated_at` set by a trigger on every update. |

The rows come from `apps/api/internal/platform/reference/seeds/sectors.csv` (15), loaded by
`cmd/deploy` and `cmd/seed` (C135, C137). Row-level security as for `countries`. The
migration is `apps/api/internal/platform/reference/migrations/00003_sectors.sql`.

### `institution_types` (platform reference data, C120, C136, C138)

Fields and the 48 seed rows confirmed 2026-10-04 by the user, with country-specific types
generalised (regional and district hospitals as `hospital`, higher secondary school as
`school`) and `dive_centre` added. The specific kind of organisation, each in one sector;
a tenant has a primary type and any number of additional ones (C138). Global, not
tenant-scoped.

| Column | Type | Rule |
| --- | --- | --- |
| `code` | `text` | Primary key; CHECK `^[a-z][a-z0-9_]{1,49}$` (`hospital`). |
| `sector` | `text` | Not null; references `sectors.code`, `ON DELETE RESTRICT`; indexed. |
| `name` | `text` | Not null, not blank. |
| `active_from` | `timestamptz` | Not null, `now()` default. |
| `active_to` | `timestamptz` | Nullable: retired; null = in use; not before `active_from`. |
| `created_at`, `updated_at` | `timestamptz` | Not null, `now()` defaults; `updated_at` set by a trigger on every update. |

The rows come from `apps/api/internal/platform/reference/seeds/institution_types.csv` (48),
loaded by `cmd/deploy` and `cmd/seed` after the sectors (C135, C137). Row-level security
as for `countries`. The migration is
`apps/api/internal/platform/reference/migrations/00004_institution_types.sql`.

### `tenants` (tenancy module, C115, C136, C139, C141)

Fields confirmed 2026-10-04 by the user, after checking the admin console's New tenant
wizard. `code` is Bool's own identifier for every tenant; `identity_number` is only the
official registry's number. The registry of customer organisations and the single
operator tenant.

| Column | Type | Rule |
| --- | --- | --- |
| `id` | `uuid` | Primary key, `uuidv7()` default. |
| `slug` | `text` | Not null, unique; a DNS label of 3–63 lowercase letters, digits, and inner hyphens; not reserved (`admin`, `api`, `identity`, `www`, …); locked by a trigger once the tenant has been active. |
| `code` | `text` | Not null, unique; CHECK `^[A-Z0-9]{2,10}$`. |
| `name` | `text` | Not null, not blank. |
| `parent_id` | `uuid` | Nullable (standalone); references `tenants.id`, `ON DELETE RESTRICT`; never itself, never a cycle, never the operator (trigger). |
| `is_operator` | `boolean` | Not null, default false; at most one true; the runtime role can never set or change it (policies). |
| `country` | `char(2)` | Not null; references `countries.code`, `ON DELETE RESTRICT`. |
| `legal_form_id` | `uuid` | Nullable until activation; with `country`, references `legal_forms (id, country)`, so the form is of the tenant's own country. |
| `identity_number` | `text` | Nullable, not blank; unique per country, case-insensitive. Required at activation when the legal form names a document, refused when it names none (application). |
| `registered_on` | `date` | Nullable. |
| `timezone` | `text` | IANA name, checked by the application; nullable until activation; no default. |
| `email` | `text` | Nullable contact, not blank. |
| `phone` | `text` | Nullable contact; CHECK `^\+[0-9]{6,15}$`. |
| `status` | `text` | `provisioning` (default), `active`, `suspended`, `archived`. |
| `activated_at`, `suspended_at`, `archived_at` | `timestamptz` | Set with the status; CHECKs keep them consistent. |
| `created_at`, `updated_at` | `timestamptz` | Not null, `now()` defaults; `updated_at` set by a trigger. |

Before a tenant leaves `provisioning`, `legal_form_id` and `timezone` are required (CHECK),
and it must have a primary institution type in `tenant_institution_types`. Changed
2026-10-04 (C141, confirmed): the `institution_type` column was removed. The operator is never suspended or archived and has no parent.
Row-level security is enabled (not forced; the registry has no `tenant_id`): a tenant reads
its own row; the operator tenant reads every row and alone creates and changes them; nothing
deletes a tenant. No migration creates a tenant. The migration is
`apps/api/internal/platform/tenancy/migrations/00001_tenants.sql`.

### `tenant_institution_types` (tenancy module, C141)

Fields confirmed 2026-10-04 by the user, who chose one table with `is_primary` over a
primary column on `tenants`. Every institution type of a tenant (C138), the primary one
flagged.

| Column | Type | Rule |
| --- | --- | --- |
| `tenant_id` | `uuid` | Not null; references `tenants.id`, `ON DELETE RESTRICT`. |
| `institution_type` | `text` | Not null; references `institution_types.code`, `ON DELETE RESTRICT`; indexed. |
| `is_primary` | `boolean` | Not null, default false; at most one true per tenant. |
| `created_at`, `updated_at` | `timestamptz` | Not null, `now()` defaults; `updated_at` set by a trigger. |

Primary key `(tenant_id, institution_type)`. A tenant outside `provisioning` has exactly one
primary: a constraint trigger on both tables, deferred to commit. To change the primary,
unflag the old row before flagging the new one. Row-level security as for `tenants`, but the
operator may delete rows. The migration is
`apps/api/internal/platform/tenancy/migrations/00002_tenant_institution_types.sql`.

### `domains` (tenancy module, C158)

Fields confirmed 2026-10-05 by the user, after example rows, keeping `is_primary` with no
redirect between a tenant's hosts. Every host that opens a tenant's workspace or one of its
portals (C132): platform hosts under Bool's own domain (`cyryx.bool.mv`, active at once) and
custom hosts the customer proves with DNS (`workspace.cyryx.edu.mv`). A host routes a request
to its tenant; it never proves access.

| Column | Type | Rule |
| --- | --- | --- |
| `id` | `uuid` | Primary key, `uuidv7()` default. |
| `tenant_id` | `uuid` | Not null; references `tenants.id`, `ON DELETE RESTRICT`; indexed. |
| `host` | `text` | Not null; normalised by the application (lowercase, ASCII/punycode, no port, no trailing dot), checked by a pattern; unique among rows not revoked. |
| `kind` | `text` | Not null; `platform` or `custom`. |
| `serves` | `text` | Not null, default `workspace`; `workspace` or a portal key an app defines in code (format check; the application checks it exists). |
| `status` | `text` | Not null, default `pending`; `pending`, `active`, or `revoked`. |
| `verification_token` | `text` | Present exactly for `custom` (check); 32+ URL-safe characters, published as a TXT record at `_bool-verify.<host>`. |
| `verified_at` | `timestamptz` | Required for an active custom host. |
| `activated_at` | `timestamptz` | Required when active. |
| `revoked_at` | `timestamptz` | Required when revoked. |
| `is_primary` | `boolean` | Not null, default false; only on active rows; at most one per `(tenant_id, serves)`. |
| `created_at`, `updated_at` | `timestamptz` | Not null, `now()` defaults; `updated_at` set by a trigger. |

Every active host serves the tenant directly; there is no redirect. The primary is the
address emails, jobs, and generated links use; the application keeps exactly one per tenant
and thing served while it has an active host for it, and revoking the primary makes the
platform host primary in the same transaction. A host, its kind, and its tenant never change
(a trigger); a new host is a new row, and a revoked host can be claimed again. Row-level
security as for `tenants`: a tenant reads its own domains, the operator reads all and alone
adds and changes them, and nothing deletes one. The request lookup is
`lookup.tenant_by_host(host)`, owned by `erp_lookup` (C131): for an active host it returns
the tenant's id, code, status, operator flag, and what the host serves; otherwise nothing.
The migration is `apps/api/internal/platform/tenancy/migrations/00003_domains.sql`.
