# Tenancy, memberships, and domains

Status: tenant model decided (C115); isolation (D02) and the tables open.

## Tenant model (C115)

- **A tenant is one customer organisation**: a ministry, council, hospital, school, or
  company. It is a data boundary with its own staff, apps, domains, admins, and
  subscription. Departments and sites are org units inside it, not tenants.
- **Parent link.** A tenant may name a parent tenant (a ministry above its schools). The
  link serves the operators' directory, billing, and later reporting. A parent sees
  nothing inside a child.
- **Sharing down.** A parent may explicitly publish a dataset (a product catalogue,
  categories, templates) to its descendants, read-only. Each app decides whether children
  copy it into their own tenant (a snapshot they then own and edit, as in inventory) or
  reference it live. Nothing is visible to children unless published, children never
  write to the parent, and every publish and copy is audited. Any other access across
  tenants is an explicit, audited grant, decided with isolation and authorization (D02,
  D05).
- **One account, many memberships.** A person has one Bool account (Kratos) and a
  membership in each tenant they work in, with its own status and roles. Ending a
  membership removes access to that tenant only; Disable (C101) ends the account
  everywhere. A request's tenant is the one whose domain it arrived on, resolved through
  the domain registry, never trusted from the hostname alone.
- **Membership is not employment.** The membership grants access; the employee record
  holds HR data. An employee may have no account, and a member (an external auditor) may
  not be an employee.
- **Operators are a tenant.** Bool's staff are members of the operator tenant, the one
  tenant with `tenants.is_operator = true`; a unique partial index allows exactly one.
  Through the admin console they manage tenant records (create, suspend, archive, plans,
  domains, admins) but cannot read inside another tenant; support access needs an
  explicit, time-limited, audited grant, decided with authorization. Operator powers
  come from membership in the operator tenant plus authorization roles (D05). The flag is
  set only by first-run setup or a migration, never through an API, and the operator
  tenant cannot be suspended or archived through the console. Self-hosted, it is the
  customer's own administrators' tenant.
- **Subscriptions are per tenant**: plan, seat limit, and enabled apps. Seats count the
  tenant's active memberships. Who pays (the tenant, or a billing account paying for
  several tenants) is decided with billing. A self-hosted licence states the tenants and
  seats it allows (D10).

Tables for tenants, memberships, and domains are approved one by one before they are
created.

## Exchanges between tenants (C117)

Some work passes between related tenants. Central procurement is the first case: an
optional arrangement between a tenant and an ancestor, limited to agreed item
categories (a health centre and its regional health centre, for medical items only);
everything else the tenant procures itself.

Such work uses **shared rows with one writer each**:
- Each row has one owner tenant (`tenant_id`), which alone writes it, and names its
  counterparty: a request owned by the child carries `receiving_tenant_id`, its
  fulfilment owned by the parent carries `requesting_tenant_id`.
- Both sides read both (`tenant_id = current OR <counterparty> = current`); writes use the
  standard `tenant_id = current` policy, so neither side can change the other's rows.
- An insert names a counterparty only through an active arrangement covering it (and,
  for procurement, the items' categories), checked by the policy through a narrow
  function.
- Only declared exchange tables may have a counterparty read rule; the CI policy test
  checks the list. Writes are audited in the writer's tenant; counterparty reads are not.

Other cross-tenant cases (a preschool whose payroll its council runs) are open.

## Approved table designs (C116)

Approved by the user on 2026-10-02 as designs, after reviewing the previous
implementation (`develop`), adopted with improvements. These are proposals, not
confirmed fields: each table's fields are confirmed explicitly, one table at a time,
before it is added to the [diagram](../data-model/erd.dbml) or gets a migration
([data model](../data-model/README.md)).

**`tenants`** (built, C139; fields in [the data model](../data-model/README.md))
- `id` uuidv7; `slug` unique, a DNS label (lowercase, 3–63 characters), not a reserved
  name (`admin`, `api`, `identity`, `www`, `mail`, …), locked by a trigger once the tenant
  has been active; `code` unique, uppercase, 2–10 characters; `name` not blank; optional
  `email` and `phone`.
- `is_operator`: at most one row true (unique partial index); the runtime role has no
  UPDATE privilege on the column; a CHECK keeps the operator from being suspended or
  archived.
- `parent_id`: never the tenant itself, never part of a cycle (trigger), never the
  operator. No ltree: each transaction walks up `parent_id` once and sets
  `app.ancestor_tenants` for policies that read published data.
- `country` references `countries.code` (C122) and `timezone` is checked by the
  application; both are chosen at provisioning, with no country defaults (the product
  is not limited to one country).
- `status` provisioning / active / suspended / archived, with guarded, audited
  transitions (409 on an illegal one); `activated_at`, `suspended_at`, `archived_at`;
  `created_at`, `updated_at` (trigger).
- Row-level security: a tenant reads its own row; the operator tenant reads all rows and
  alone inserts and updates them.
- Classification (C120, C141): `legal_form`, institution types in
  `tenant_institution_types` (one primary; sectors follow), and
  `identity_number`, whose kind the legal form decides. Deferred: the local-script
  name. The subscription (plan, seats, apps) lives in its own tables.

**The operator tenant** (C142)
- Bool, created by the `tenancy.operator` seed file (`tenancy/seeds/operator.go`) in every
  database: `cmd/deploy` in production, `cmd/seed` in development, as the table owner, the
  only role that can create an operator. Slug `workspace` (its staff use
  `workspace.bool.mv` like any workspace), code `BOOL`, active, primary type `it_services`.
- An existing operator is left as it is, so changes made later stay. The registration
  number is a placeholder (`C-1024/2026`) until Bool's real one is set.

**Sample tenants** (C143): development only, from `tenancy/seeds/sample_tenants.csv`.

**Classification reference tables** (C120, structure C136)
- Owned by the `reference` module; loaded from seed files by `cmd/deploy` and `cmd/seed` (C135, C137). Each legal form also
  carries a global **category** (`government`, `private`, `non_profit`,
  `international`): rules that differ by kind of organisation attach to the category,
  never to one country's forms. A tenant's classification is required before it can
  become active. FindCare finds healthcare providers by sector and filters by
  institution type and category. A tenant has one primary institution type and any
  number of additional ones, all in `tenant_institution_types` with the primary
  flagged (C138, C141), set by operators.
- Two dimensions: what an organisation is in law (**legal form**) and what it does
  (**sector**, refined by **institution type**). A private and a government hospital
  share the institution type and differ in legal form.
- `legal_forms`, `sectors`, `institution_types` (each institution type belongs to one
  sector): a stable `code`, a `name`, and active/retired dates.
- **Legal forms belong to a country** (`country`, referencing `countries.code`): each country has its
  own list, and each legal form names the identity document its tenants carry (company
  registration number, …, or none). A tenant picks a legal form of its own country.
- **Sectors and institution types are global**, with country-neutral names.
- A tenant picks a legal form and an institution type; its sector follows.
- Not tenant-scoped: readable by every tenant, written only by the operator
  tenant (admin console), so a new type needs no release. Code attaches behaviour by
  `code` where it matters (the identity document by legal form; provisioning templates
  and arrangements by institution type or sector) and falls back to a generic default
  for entries added later.
- Seeded initially with:
  - **Legal forms, Maldives (`MV`), the first country:** government ministry / central
    office; independent institution; statutory body; judiciary / parliament; local
    council (city, atoll, island) — none of
    these carries an identity number; state-owned enterprise, public company (Plc), and
    private company (Pvt Ltd) — company registration number; partnership / sole
    proprietorship — business registration number; cooperative society — cooperative
    registration number; association / NGO — association registration number;
    international organisation / mission — none.
  - **Sectors and institution types (global; confirmed 2026-10-04):** the 15 sectors in
    `reference/seeds/sectors.csv` and the 48 institution types in
    `reference/seeds/institution_types.csv` (for example health: hospital, health centre,
    clinic, pharmacy, laboratory).
- Classification is required before a tenant becomes active, not at creation (C136).

**`memberships`** (C160, confirmed 2026-10-05; [data model](../data-model/README.md))
- `id`, `tenant_id`, `user_id`; unique `(tenant_id, id)` so tenant tables reference a
  membership with a foreign key that includes `tenant_id`.
- `status` invited / active / disabled (reversible) / ended (final history, never
  reused: rejoining is a new row), with `invite_expires_at`, `joined_at`, `disabled_at`,
  and `ended_at` following it; an expired invitation is an invited row past its expiry.
  `is_owner` (one per tenant, invited or active, transferred only by a dedicated action);
  `invited_by`.
- One live membership per person and tenant; tenant and user never change.
- Row-level security: members read and change their tenant's memberships (Cerbos decides
  who); operators read, create, and change only owner memberships of other tenants; none
  are deleted. `lookup.active_membership` answers `RequireMember` and
  `lookup.memberships_of` the switcher (with each tenant's primary workspace host).
- Seats are the tenant's active and invited memberships. Inviting someone without an
  account creates their Kratos account and user first and sends a set-password link.
- Seeded memberships (C161), written as the table owner until tenancy has an invite
  operation, each active, joined at seeding, and invited by nobody; a person with a live
  membership is left as they are, and the owner flag is set only on a tenant without one:
  - `tenancy.operator_members`, in every database (`cmd/deploy` after the team's
    accounts, `cmd/seed` last): the team in the operator tenant, Ahmed Shifau its owner.
  - `tenancy.sample_members`, in `dev` only: the team in every sample tenant, Ahmed Shifau
    the owner of each, and the end-to-end account (`e2e@bool.test`) a member of male-city.

**`domains`** (C158, confirmed 2026-10-05; [data model](../data-model/README.md))
- Every host that opens a tenant's workspace or one of its portals: `platform` hosts under
  Bool's own domain (`cyryx.bool.mv`, created at provisioning and active at once) and
  `custom` hosts the customer proves with a TXT record at `_bool-verify.<host>`
  (`workspace.cyryx.edu.mv`). `host` is stored normalised (lowercase, ASCII/punycode, no
  port, no trailing dot) and is unique while not revoked; `serves` is `workspace` or a
  portal key an app defines (C132), so `workspace.cyryx.edu.mv` and `portal.cyryx.edu.mv`
  both belong to Cyryx but open different applications.
- **No redirect:** every active host serves the tenant directly; each has its own BFF
  session, signed in silently through the login service. **`is_primary`** (one per tenant
  and thing served) is the address emails, jobs, and generated links use; revoking the
  primary makes the platform host primary in the same transaction, so the platform host is
  the fallback that keeps a tenant reachable.
- A host, its kind, and its tenant never change; a new host is a new row. Domains are
  revoked, never deleted.
- Only active hosts resolve; pending, revoked, and unknown hosts get the same 404 and
  cannot start a login. A background job re-checks custom domains and revokes one whose
  record is gone (built with step 7f).
- Row-level security: a tenant sees its own domains, the operator tenant all, and only the
  operator adds or changes them for now. The request lookup is
  `lookup.tenant_by_host(host)`, owned by `erp_lookup` (C131).
  The admin console (`admin.bool.mv`) is a separate operator-only domain, not a
  workspace, configured like a product domain (C142). Product domains such as
  `findcare.mv` are not tenants' domains and are not in this table (C131).
- Every active host needs its TLS certificate, an edge route to the BFF, and its callback
  and logout addresses on the Hydra client; driving those from this table belongs to step
  7f and deployment.

**Portals** (C132)
- A tenant may enable any number of portal types that Bool's apps define (a student
  portal, a lecturer portal, …) and give each its own domains; the portal's pages,
  permissions, and data come from the app's code. All portals use the same API.
- Each portal domain is a Hydra client with its own login design; portal apps are
  public-facing (Next.js, C87).
- Who gets in (C133): staff are members, with roles that open their portals; students,
  applicants, and patients sign in with ordinary accounts that the app's own records
  link to, and never become members or seats.

**Resolving a request's tenant** (code shape: C144)
- The tenant travels in `context.Context`, set by the `ResolveTenant` middleware (HTTP), a
  `--tenant` / `--all-tenants` flag (CLI), or a job's stored tenant (workers); each
  transaction applies it with `SET LOCAL`. Guards run in order: `Authenticate`,
  `RequireUser` or `RequireClient`, `ResolveTenant`, `RequireMember`,
  `RequireActiveTenant`; modules use the named chains in `platform.Services`.
- Built: `tenancy/tenant` (`With`/`From`, `WithMembership`/`MembershipFrom`, `Tx`/`ReadTx`
  with `ErrNoTenant` and `ErrNested`, C145); `auth.RequireUser`; the tenancy guards
  (`tenancy/middleware.go`) and `platform.Services` with the **`TenantUser`** chain
  (C162), which also records the actor for the audit (`auth.Actor`, C164). `TenantClient` and `Operator` come with their first routes. No maintained Go
  library provides tenant context with PostgreSQL row-level security, so this is our own
  code (a recorded gap, C144): `context.Context`, chi middleware, and pgx's `BeginTxFunc`.
- `ResolveTenant`: the request's host, normalised (lowercase, no port or trailing dot),
  must be an active host serving `workspace` (`lookup.tenant_by_host`); a portal host,
  an unknown host, or no host is 404. Host only for now (C162): the header for direct API
  clients (mobile, integrations) and its name are decided with the first such client.
  The host never proves access.
- `RequireMember`: the person's active membership (`lookup.active_membership`); none
  (including invited, disabled, and ended) is 404, the same answer as an unknown host.
  It puts the membership in the context, and the principal gains the Cerbos role
  `member` (C153).
- `RequireActiveTenant`: 403 with the problem type
  `https://bool.mv/problems/tenant-provisioning`, `…/tenant-suspended`, or
  `…/tenant-archived` for a tenant that is not active (C162).
- The lookups run on every tenant request (two queries before the transaction); caching
  them is open (C131).
- **`GET /api/v1/tenant`** (C162): the request's tenant (`id`, `code`, `name`, `status`),
  behind `TenantUser`, read in `ReadTx` and checked with Cerbos (`tenancy:tenant` `view`).
- The lookup before any tenant is known (C131): a `SECURITY DEFINER` function owned by
  `erp_lookup`, a `NOLOGIN BYPASSRLS` role with column-level `SELECT` on only the
  columns it reads and no writes. It pins `search_path`, schema-qualifies its tables,
  takes the host as a parameter, and returns the tenant (id, code, status, operator flag)
  and what the domain serves (the workspace or a portal, C132), or nothing:
  `lookup.tenant_by_host` (C158). Only the runtime role
  may execute it; the policies themselves are not loosened.
- Every outsider gets the same 404 (unknown host, a tenant they do not belong to, a
  suspended one), so tenants and their status cannot be probed. A member of a tenant
  that is not active gets 403 with `tenant_suspended` or `tenant_archived`.
- Suspension signs no one out: the login belongs to the person, who may work in other
  tenants; it is enforced on every request.

**Row-level security mechanics**
- Each tenant transaction sets `app.tenant_id` (and `app.ancestor_tenants`) with
  `SET LOCAL`, so nothing survives into the next use of a pooled connection.
- A tenant transaction starts only from the pool, never inside another transaction: one
  operation is one transaction with one tenant. This removes the previous
  implementation's save-and-restore around savepoints, where a released savepoint kept the
  inner tenant (a silent cross-tenant leak).
- The runtime role owns no tables and cannot bypass row-level security; every tenant
  table uses `FORCE ROW LEVEL SECURITY`; `tenant_id` defaults to the current tenant;
  foreign keys between tenant tables include `tenant_id`.
- Reading and writing have separate policies: on tables that support publishing, reads
  allow the tenant's rows and rows its ancestors published, while UPDATE and DELETE allow
  only the tenant's own rows (one shared policy would let a child update the parent's
  published rows).
- Policies read `current_setting('app.tenant_id', true)`: unset, no rows match and
  inserts fail.
- No read policy names another tenant, except declared exchange tables (C117), whose
  rows are read by their counterparty and written only by their owner.
- The operator exception exists only on the registry (`tenants`, `domains`, owner
  memberships). Support access will switch the transaction into the target tenant through
  a grant, recorded in audit as acting-as.
- A CI test fails any table with `tenant_id` and no policy. Tests run as the runtime role:
  cross-tenant reads and writes, a missing tenant, rollback, a reused pooled connection,
  and a child changing a published row.

**`audit_log`** (design shared with [audit](audit.md))
- `id`, `tenant_id` (the tenant whose data changed), `actor_user_id`, `actor_tenant_id`
  (an operator acting on a customer is recorded in the customer's audit, from the operator
  tenant), `acting_as_user_id` and `support_grant_id` (support access), `entity_type`,
  `entity_id`, `action`, `outcome` (succeeded / denied), `payload` (changed fields, or a
  full snapshot on create and delete), `request_id`, `ip`, `occurred_at`.
- Append-only twice over: a trigger rejects UPDATE, DELETE, and TRUNCATE, and the runtime
  role is never granted them.
- A change and its audit row commit together; a failed audit write fails the change. A
  refused attempt at a protected operation is recorded as denied in its own transaction.
- Fields a module marks sensitive are recorded as changed without their values; secrets
  never enter the payload.
- Recorded explicitly by the application (only it knows the actor, intent, and grant); a
  test per change operation checks its audit row.
- Row-level security: a tenant reads its own audit with `audit:view`. Kept at least 7
  years; monthly partitions when volume needs them.

**Authorization tables** (design shared with [authorization](authorization.md))
- Cerbos decides on every protected operation, denying by default; an `operator` derived
  role comes from membership in the operator tenant. Capabilities (`members:invite`,
  `audit:view`, `platform:tenants:suspend`, …) are a catalogue in code, checked when
  saved.
- `roles`: every row belongs to a tenant (under row-level security). Role templates
  (owner, admin, member per app) are defined in code and copied into a tenant's roles
  when it activates the app; each copy keeps its `template_key` so template changes can
  be offered later. `role_capabilities` lists a role's capabilities.
- `role_assignments` (previously `user_roles`) reference `(tenant_id, membership_id)`:
  no membership, no role, and ending a membership ends its roles. Time-bounded
  (`active_from`, `active_to`, for acting appointments); revoking sets the end, never
  deletes.
- A trigger rejects `platform:` capabilities on roles outside the operator tenant, in
  addition to Cerbos's operator check.
- Dropped: per-person app subscriptions (`user_apps`). Later: `tenant_settings`,
  two-person approval of role requests, and support-access grants.

**Subscription and enabled apps**
- The app catalogue is code (the app packages), like capabilities and role templates.
  `tenant_apps` records `(tenant_id, app_key, activated_by, active_from, active_to)`;
  activating an app copies its role templates into the tenant; history is kept.
- `subscriptions`: `tenant_id`, `plan`, `seat_limit`, `starts_at`, `ends_at`, with
  history (a change ends one row and starts the next), managed by the operator. What a
  plan includes is a catalogue in code until billing.
- Invitations are refused once active and invited memberships reach the seat limit.
- Prices, invoices, payments, and the paying party wait for the billing design.

**Provisioning**
- One flow for every caller (an operator now; self-service sign-up and the self-hosted
  first run later).
- The owner's Kratos account is found by email or created first (idempotent). Then one
  database transaction creates the tenant, its default domain, the subscription, the
  enabled apps with their roles, the owner membership, and the audit rows. If it fails,
  the Kratos account is reused on retry (the previous design claimed one transaction, but
  a Kratos account cannot be rolled back).
- The owner's email goes out only after commit.
- The operator tenant is created only by a first-run setup command, the one path that
  sets `is_operator`.
- Provisioning requests carry an idempotency key, so a retry cannot create a second
  tenant.
- Sector templates are deferred with classification; every tenant starts from the same
  defaults.

## Domain requirements

Support default domains such as `cyryx.bool.mv` and verified custom domains such as
`app.cyryx.mv` or `cyryx.mv`. Hostnames route requests; they do not prove access.

The design must address normalized hostname lookup, ownership verification,
activation/revocation, trusted proxy headers, TLS, redirect validation, and
unknown/unverified hosts. The registry is `domains` (C158); the verification job, TLS, and
Hydra addresses per host come with step 7f.

## Isolation (D02, decided in part in C115)

Tenant data lives in shared PostgreSQL tables with `tenant_id`, protected by row-level
security under a non-owner runtime role that cannot bypass it, with tenant-aware foreign
keys. The tenant registry uses the same policies: a tenant sees its own row, the operator
tenant all rows. A lookup made before any tenant is known (which tenant owns a domain)
goes through a narrow database function. The policy details (setting the tenant per
transaction, mutation policies, the published-data rule, the lookup function) are
settled with the first tenancy tables.

Tenant scope must apply to reads, writes, jobs, caches, and audit queries.
Use transaction-local database settings; test missing scope and pooled connection reuse.

Read visibility and mutation policies must be separate: broad descendant visibility
must not authorize descendant updates or deletes. WITH CHECK does not protect
DELETE operations. Aggregate-only access must not expose unrestricted detail reads.
See [PostgreSQL policy semantics](https://www.postgresql.org/docs/18/sql-createpolicy.html).

No historical schema-per-tenant, hierarchy, or visible-set design is inherited.
See [identity](identity.md), [authorization](authorization.md), [deployment](deployment.md), and
[self-hosting](self-hosting.md).
