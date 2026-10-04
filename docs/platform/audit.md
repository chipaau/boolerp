# Business audit

Status: designed (C146–C148, refining C116); not implemented yet. Fields of `audit_log` are
confirmed with its migration (C121).

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

## Changes: the audit trigger (C147)

- A module opts a table in from its migration: `audit.enable('employees', exclude => ARRAY['salary'])`.
- For each changed row, in the same transaction: the new row (insert), the old row (delete),
  or only the changed columns (update; a no-op update records nothing). Excluded columns are
  recorded as changed, never with values.
- Tenant from the row's `tenant_id` (the registry's own ID for `tenants`; none for global tables).
- Actor, actor tenant, operation, request ID, IP, and support grant from the `app.*` settings
  `tenant.Tx` sets; the database role (`session_user`) always, so manual fixes are attributed.
- Only the trigger function, owned by a login-less audit role, inserts into `audit_log`; the
  table is append-only (no UPDATE or DELETE grants, a trigger refusing them and TRUNCATE).
  Row-level security: a tenant reads its own rows with `audit:view`; the operator reads all.
- Our own code (a recorded gap): no maintained Go package exists, and pgMemento adds a column
  to every audited table, does not fit the tenant model, and is LGPL.

## The audit context (C147)

- A middleware in the `TenantUser`, `TenantClient`, and `Operator` chains puts the actor, the
  operation (chi's route pattern such as `PATCH /api/hrms/employees/{id}`, or a name set with
  `audit.Named`), the request ID, and the trusted-proxy IP in `ctx`. It writes nothing.
- CLI commands (`cli: …`), background jobs (`job: …`, the original actor stored with the job),
  and seeders (`seed: …`) set the same context.

## Sensitive reads (C148)

- PostgreSQL has no triggers on `SELECT`, and auditing every read would multiply the table's
  volume and turn reads into writes. Plain screens and lists are covered by Cerbos decision logs.
- Routes that show sensitive data (documents, payslips, medical notes) and every export opt in
  with `audit.Read("hrms.employee.documents")`: after a successful response it writes an
  `action = 'read'` row (actor, tenant, operation, request ID, the record's ID) to `audit_log`,
  in its own transaction.
- **Fail closed:** if the read event cannot be written, the data is not returned.

## Still open

- The exact `audit_log` columns (confirmed with its migration) and the retention policy.
- Cerbos's log backend and where its logs are kept, so they are durable and searchable.

See [tenancy](tenancy.md), [authorization](authorization.md), [observability](observability.md),
and the [decision register](../decisions/README.md).
