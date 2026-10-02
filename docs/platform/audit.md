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
that rolls back. Their recording policy needs a separate decision.

## Open decisions

- Which actions, reads, failures, and access changes are audited.
- Application capture, database capture, or a combination.
- Redaction and sensitive employee data allowed in before/after evidence.
- Immutability controls, read permissions, retention, archival, and export.
- Behavior if audit persistence fails and whether administrative maintenance differs
  from normal application access.

No historical retention duration, partitioning scheme, or universal delete snapshot
requirement is inherited.

See [execution](execution.md), [observability](observability.md), and [data-model status](../data-model/README.md).
