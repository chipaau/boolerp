# Business audit

Status: built (C164): `audit_log`, the capture trigger on every table, the partitions, and the
actor context. Sensitive-read events (C148) come with the first sensitive route; the retention
job and Cerbos's log backend are open. Fields of `audit_log` are in the
[data model](../data-model/README.md#audit_log-audit-module-c146-c147-c164).

Audit records explain business actions and their actors. Technical logs and traces
are not a replacement, and Redis is not the durable audit store.

## Three layers, each with one job

| Question | Answered by |
| --- | --- |
| What changed, old → new? | the audit trigger (C147) |
| Who changed it, for which tenant, through which endpoint, command, or job? | the audit context, applied by `tenant.Tx` (C147) |
| Who viewed sensitive data or exported it? | opt-in read events (C148) |
| Who tried to read or change what, allowed or denied? | Cerbos decision logs (C146) |
| How long did a request take, what failed? | tracing and logs ([observability](observability.md)) |

## Storage (C146)

- One `audit_log` table in the audit platform module, in the main database, so a change and
  its audit commit together, with one backup and simple self-hosting.
- Partitioned by month on `occurred_at` from the start. `cmd/deploy` and `cmd/seed` create
  future months ahead; a default partition means no row is ever lost.
- Months past the retention window (at least 7 years, C116; exact policy open) are detached,
  exported to object storage, and dropped.
- Moving audit to its own database later means adding a shipper (outbox), not changing modules.

## Changes: the audit trigger (C147, C164)

- **Every table is audited** (C164). Each table's migration calls
  `audit.enable('employees', exclude => ARRAY['salary'])`; `tenant_column => 'id'` for a table
  whose own id is its tenant (`tenants`); by default `tenant_id` when the table has one. A
  feature test (`audit_feature_test.go`) fails for any table without the trigger. The audit
  module migrates first, so the function exists for every later migration.
- For each changed row, in the same transaction: the new row (insert), the old row (delete),
  or only the changed columns (update; a no-op update records nothing). Excluded columns are
  recorded as changed, never with values.
- Tenant from the row's `tenant_id` (the registry's own ID for `tenants`; none for global tables).
- Actor, actor tenant, operation, request ID, IP, and support grant from the `app.*` settings
  `tenant.Tx` sets; the database role (`session_user`) always, so manual fixes are attributed.
- An update that changes nothing but `updated_at` records nothing. `record_id` is the primary
  key (key columns joined with `/`).
- Only the trigger function (`audit.capture`, `SECURITY DEFINER`) inserts into `audit_log`. The
  login-less role `erp_audit` (created by the PostgreSQL init script, like `erp_lookup`) owns
  the table, its partitions, and the functions; the table is append-only for everyone, the
  owner included (triggers refuse UPDATE, DELETE, and TRUNCATE of the table and each
  partition). Row-level security: a tenant reads its own rows (the API will check
  `audit:view`); the operator reads all. Partitions are in the `audit` schema, which the
  runtime role cannot use, so it never bypasses those policies.
- Our own code (a recorded gap): no maintained Go package exists, and pgMemento adds a column
  to every audited table, does not fit the tenant model, and is LGPL.

## The audit context (C147, C164)

- `kit/actor` carries the actor in `ctx`. A writing transaction is opened only by
  `tenant.Tx` (inside a tenant) or `actor.Tx` (outside one: users, seed files); both set the
  actor as `app.*` settings local to the transaction first, so no write can miss it.
  `auth.Actor` (in the auth routes and the `TenantUser` chain; later
  `TenantClient` and `Operator`) records the person, the client, the operation (chi's route
  pattern such as `PATCH /api/hrms/employees/{id}`), the request ID, and the trusted-proxy IP.
  It writes nothing.
- `tenant.Tx` adds the acting tenant; identity's user writes and every seeder transaction
  use `actor.Tx`, and `seed.Run` names the seeder (`seed: tenancy.operator`). CLI
  commands (`cli: …`) and background jobs (`job: …`, the original actor stored with the job)
  set the same context when they exist.

## Sensitive reads (C148)

- PostgreSQL has no triggers on `SELECT`, and auditing every read would multiply the table's
  volume and turn reads into writes. Plain screens and lists are covered by Cerbos decision logs.
- Routes that show sensitive data (documents, payslips, medical notes) and every export opt in
  with `audit.Read("hrms.employee.documents")`: after a successful response it writes an
  `action = 'read'` row (actor, tenant, operation, request ID, the record's ID) to `audit_log`,
  in its own transaction.
- **Fail closed:** if the read event cannot be written, the data is not returned.

## Partitions (C146, C164)

- `audit.create_partitions(parent, months)` creates the current and next months (UTC), each
  `audit.audit_log_yYYYYmMM`; the `audit.partitions` seed file runs it first in `DataSeeders`
  (`cmd/deploy`, `cmd/seed`), four months ahead. `audit.audit_log_default` keeps any row
  outside them.

## Still open

- The retention policy and job, sensitive-read events (with the first sensitive route), and
  indexes (with the first audit read).
- Cerbos's log backend and where its logs are kept, so they are durable and searchable.

See [tenancy](tenancy.md), [authorization](authorization.md), [observability](observability.md),
and the [decision register](../decisions/README.md).
