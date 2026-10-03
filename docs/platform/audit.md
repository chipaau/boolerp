# Business audit

Status: required; the `audit_log` design is approved (C116), see
[tenancy](tenancy.md#approved-table-designs-c116). Not implemented yet.

Audit records explain business actions and their actors. Technical logs and traces
are not a replacement, and Redis is not the durable audit store.

## Proposed design

Use durable PostgreSQL audit persistence with append-only application/runtime access.
Successful employee changes and their required audit records should commit in the
same transaction. Decide how capture is enforced before implementing write paths.

Candidate evidence includes tenant, actual actor, affected employee, action,
time, permitted change details, and request/trace correlation. These are discussion
items, not an approved table. Impersonation, if introduced, must preserve both the
actual actor and effective subject.

Denied/failed attempts cannot rely solely on an audit write inside a transaction
that rolls back: a refused attempt is recorded as `denied` in its own transaction (C116).

## Open decisions

Decided (C116): every create, update, and delete is audited with its change, plus
denied attempts; capture is explicit in the application, in the same transaction (a
failed audit write fails the change); sensitive fields are redacted; the table is
append-only twice over; tenants read their own audit with `audit:view`; kept at least
7 years. Still open:

- Whether sensitive reads (salaries, national IDs) are audited too.
- The capture API modules call, with the transaction contract (D06).
- Archival and export, and monthly partitioning when volume needs it.

See [execution](execution.md), [observability](observability.md), and [data-model status](../data-model/README.md).
