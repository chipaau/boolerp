# Data model status

Updated: 2026-10-05.
Status: open. Confirmed and implemented: `users`, `countries`, `legal_forms`, `sectors`,
`institution_types`, `tenants`, `tenant_institution_types`, `domains`, and `memberships`
(below). (A `sessions`
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

### `memberships` (tenancy module, C160)

Fields confirmed 2026-10-05 by the user. A person's access to a tenant they work in: one
account, many memberships (C115). Not employment (the employee record is HRMS's); portal
users never become members (C133).

| Column | Type | Rule |
| --- | --- | --- |
| `id` | `uuid` | Primary key, `uuidv7()` default; also unique `(tenant_id, id)` for tenant-aware foreign keys. |
| `tenant_id` | `uuid` | Not null; references `tenants.id`, `ON DELETE RESTRICT`. |
| `user_id` | `uuid` | Not null; references `users.id`, `ON DELETE RESTRICT` (a cross-module key, C134); indexed. |
| `status` | `text` | Not null, default `invited`; `invited`, `active`, `disabled` (reversible), or `ended` (final). |
| `is_owner` | `boolean` | Not null, default false; only when invited or active; at most one per tenant. |
| `invited_by` | `uuid` | Nullable; references `users.id`; null when provisioning or a seed created it. |
| `invite_expires_at` | `timestamptz` | Required when invited; an invited row past it is an expired invitation. |
| `joined_at` | `timestamptz` | Required when active or disabled. |
| `disabled_at` | `timestamptz` | Required when disabled. |
| `ended_at` | `timestamptz` | Required when ended. |
| `created_at`, `updated_at` | `timestamptz` | Not null, `now()` defaults; `updated_at` set by a trigger. |

One live membership per person and tenant (unique while not ended); an ended membership is
frozen history and rejoining is a new row. Tenant and user never change (a trigger). Seats
are the tenant's invited and active memberships. To transfer ownership, unflag the old owner
before flagging the new one. Row-level security: members read and change their tenant's
memberships (Cerbos decides who); the operator also reads, creates, and changes owner
memberships of any tenant, and nothing else outside its own; nothing deletes one. Two
lookups owned by `erp_lookup` (C131): `lookup.active_membership(tenant, user)` for
`RequireMember` (the active membership and the tenant's status, in one call) and
`lookup.memberships_of(user)` for the switcher (active memberships with each tenant's
primary workspace host). The migration is
`apps/api/internal/platform/tenancy/migrations/00004_memberships.sql`.

### `audit_log` (audit module, C146, C147, C164)

Fields confirmed 2026-10-06 by the user, without `support_grant_id` (added when support
grants exist) and with no index beyond the primary key (indexes are proposed with the first
audit read). One append-only table of every change to every table, written only by the
capture trigger, in the same transaction as the change. Partitioned by month on
`occurred_at`; owned by `erp_audit`.

| Column | Type | Rule |
| --- | --- | --- |
| `id` | `uuid` | Not null, `uuidv7()` default; primary key `(occurred_at, id)` (a partitioned table's key includes the partition column). |
| `occurred_at` | `timestamptz` | Not null, `now()` default: the transaction's time. |
| `tenant_id` | `uuid` | Nullable: the row's tenant (`tenants`: its own id; global tables: null). No foreign key. |
| `action` | `text` | Not null; `insert`, `update`, `delete`, or `read` (C148). |
| `entity` | `text` | Not null, not blank: the table, or a read event's name. |
| `record_id` | `text` | Not null: the row's primary key (key columns joined with `/`). |
| `old_values` | `jsonb` | Nullable: delete, the old row; update, old values of changed columns. |
| `new_values` | `jsonb` | Nullable: insert, the new row; update, new values of changed columns. |
| `changed_columns` | `text[]` | Nullable: update only; excluded columns listed, never their values. |
| `actor_user_id` | `uuid` | Nullable: the person. |
| `actor_client_id` | `text` | Nullable: the OAuth client the token was issued to. |
| `actor_tenant_id` | `uuid` | Nullable: the tenant the actor acted in. |
| `operation` | `text` | Nullable: route pattern, `cli: …`, `job: …`, or `seed: …`. |
| `request_id` | `text` | Nullable. |
| `ip` | `inet` | Nullable: the client as the trusted proxy reported it. |
| `db_role` | `text` | Not null, `session_user` default: the login role, so manual fixes are attributed. |

Append-only: triggers refuse update, delete, and truncate (of the table and each
partition), the owner included; old months are detached and dropped. The runtime role only
reads, through row-level security (its own tenant's rows; the operator tenant every row);
partitions live in the `audit` schema, which it cannot use. Partitions are created ahead by
`audit.create_partitions` (the `audit.partitions` seed file); a default partition keeps any
other row. The migration is `apps/api/internal/platform/audit/migrations/00001_audit_log.sql`.

### `apps` (authorization module, C165)

Fields confirmed 2026-10-06 by the user, with the first rows: `admin` (Admin console,
operator) and `control-centre` (Control Centre, workspace); business apps are added with
their backend modules. The catalogue of Bool's apps, mirrored from code: each module
declares its app and the edition lists them (`full.Apps`); the `authorization.apps` seed
file writes them here on every `cmd/deploy` and `cmd/seed`. Global, not tenant-scoped.

| Column | Type | Rule |
| --- | --- | --- |
| `key` | `text` | Primary key; `^[a-z][a-z0-9-]{1,30}$`, the frontend manifest's slug. |
| `name` | `text` | Not null, not blank. |
| `kind` | `text` | Not null; `workspace` (a tenant's members use it), `operator` (only the operator tenant may activate it), or `product` (a separate product across tenants, such as FindCare). |
| `description` | `text` | Nullable. |
| `active_from` | `timestamptz` | Not null, `now()` default. |
| `active_to` | `timestamptz` | Nullable, not before `active_from`; set when the app leaves the code. |
| `created_at`, `updated_at` | `timestamptz` | Not null, `now()` defaults; `updated_at` set by a trigger. |

Everyone reads; no write policy, so only the seed file (the owning migration role) changes
it. An app no longer in the code is retired (`active_to`), never deleted, and listed again
it becomes active. Audited. The migration is
`apps/api/internal/platform/authorization/migrations/00001_apps.sql`.

### `tenant_apps` (authorization module, C116, C166)

Fields confirmed 2026-10-06 by the user. Which apps each tenant has turned on, with
history; only the operator tenant turns them on and off for now (the user's choice: apps
follow what the customer bought, D10).

| Column | Type | Rule |
| --- | --- | --- |
| `id` | `uuid` | Primary key, `uuidv7()` default; also unique `(tenant_id, id)`. |
| `tenant_id` | `uuid` | Not null, `current_tenant_id()` default; references `tenants.id`, `ON DELETE RESTRICT`. |
| `app_key` | `text` | Not null; references `apps.key`, `ON DELETE RESTRICT`. |
| `activated_by` | `uuid` | Nullable; references `users.id`; null when provisioning or a seed turned it on. |
| `active_from` | `timestamptz` | Not null, `now()` default. |
| `active_to` | `timestamptz` | Nullable, not before `active_from`: set when turned off. |
| `created_at`, `updated_at` | `timestamptz` | Not null, `now()` defaults; `updated_at` set by a trigger. |

One live activation per tenant and app (unique while `active_to` is null); turning an app
on again is a new row, and an ended one is frozen. A trigger refuses an `operator` app
outside the operator tenant, a retired app, and changing an activation's tenant or app.
Who turned an app off is in the audit log. Row-level security: a tenant reads its own; the
operator tenant reads every tenant's and alone creates and ends them; nothing deletes one.
Seeds: `authorization.operator_apps` turns on `admin` and `control-centre` for the operator
(every database); `authorization.sample_apps` turns on `control-centre` for each sample
tenant (development). The migration is
`apps/api/internal/platform/authorization/migrations/00002_tenant_apps.sql`.

### `roles` (authorization module, C167)

Fields confirmed 2026-10-06 by the user. What a person may do in one app: a role belongs
to one app (an app has many roles) and grants only that app's capabilities. **Global
roles** (`tenant_id` null) are Bool's, declared in each app's code and mirrored by the
`authorization.roles` seed file (with `role_capabilities`), matched by `key`; a tenant
creates **its own** (`tenant_id` set) for anything else.

| Column | Type | Rule |
| --- | --- | --- |
| `id` | `uuid` | Primary key, `uuidv7()` default. |
| `tenant_id` | `uuid` | Nullable: null for a global role; references `tenants.id`, `ON DELETE RESTRICT`. |
| `app_key` | `text` | Not null; references `apps.key`, `ON DELETE RESTRICT`. |
| `key` | `text` | Global roles only (required for them, absent otherwise); unique; `<app key>.<name>`, such as `hrms.admin`. |
| `name` | `text` | Not null, not blank; unique per app among live global roles, and per tenant and app among a tenant's live roles (case-insensitive); a tenant's live role may not repeat a live global role's name in its app. |
| `description` | `text` | Nullable. |
| `archived_at` | `timestamptz` | Nullable: an archived role is not newly assigned and is hidden; roles are never deleted. |
| `created_at`, `updated_at` | `timestamptz` | Not null, `now()` defaults; `updated_at` set by a trigger. |

A trigger keeps a role's tenant, app, and key, requires a tenant's role to belong to an app
that is on in that tenant, and refuses a tenant role named like a global one (a global role
added later may share a tenant role's name). Row-level security: a tenant reads its own and
the global roles and creates and changes only its own; global roles are written only by the
seed file; nothing deletes a role. Audited. The migration is
`apps/api/internal/platform/authorization/migrations/00003_roles.sql`.

### `capabilities` (authorization module, C168)

Fields confirmed 2026-10-06 by the user. What a role may grant, mirrored from code like
`apps`: each app declares its capabilities (`authorization.App.Capabilities`) and the
`authorization.capabilities` seed file writes them here on every `cmd/deploy` and `cmd/seed`.
First rows: `tenancy:tenant:view` and `tenancy:tenant:manage` (C153), granted by the admin
console; other apps' capabilities come with their routes, each agreed first.

| Column | Type | Rule |
| --- | --- | --- |
| `key` | `text` | Primary key; `<module>:<resource>:<level>`, the level `view`, `manage`, or `delete` (C153). |
| `app_key` | `text` | Not null; references `apps.key`: the one app whose roles may grant it. |
| `name` | `text` | Not null, not blank. |
| `description` | `text` | Nullable. |
| `active_from` | `timestamptz` | Not null, `now()` default. |
| `active_to` | `timestamptz` | Nullable, not before `active_from`; set when it leaves the code. |
| `created_at`, `updated_at` | `timestamptz` | Not null, `now()` defaults; `updated_at` set by a trigger. |

Global: everyone reads, only the seed file writes; retired, never deleted. Audited. The
migration is `apps/api/internal/platform/authorization/migrations/00004_capabilities.sql`.

### `role_capabilities` (authorization module, C169)

Fields confirmed 2026-10-06 by the user, keeping `tenant_id` so a tenant's audit shows
changes to its roles. Which capabilities each role grants, one row per pair.

| Column | Type | Rule |
| --- | --- | --- |
| `role_id` | `uuid` | Not null; references `roles.id`, `ON DELETE RESTRICT`; with `capability`, the primary key. |
| `capability` | `text` | Not null; references `capabilities.key`, `ON DELETE RESTRICT`. |
| `tenant_id` | `uuid` | Nullable: always the role's tenant (null for a global role), set by the trigger whatever the caller sends; references `tenants.id`. |
| `created_at` | `timestamptz` | Not null, `now()` default: when the role gained it. |

Rows are added and removed (the audit keeps the history), never updated. A trigger sets
the tenant from the role and refuses a capability of another app or a retired one.
Row-level security: a tenant reads its own roles' and the global roles' capabilities, and
adds and removes only its own roles'; global roles' come only from the seed file. Audited.
The migration is `apps/api/internal/platform/authorization/migrations/00005_role_capabilities.sql`.
