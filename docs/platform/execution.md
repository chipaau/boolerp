# Transactions and background execution

Status: explicit operation boundaries required by the architecture; concrete contracts open.

## Proposed transaction boundary

An application use case defines what must succeed atomically. A small transaction
port supplies persistence dependencies bound to one PostgreSQL transaction; no
pgx transaction object leaks into domain or application APIs.

For an employee write, the proposal is to commit employee persistence and required
successful-change audit evidence together. With pooled RLS, the same transaction
establishes tenant-local scope. Return success only after commit.

Separate runtime and migration privileges. The proposed migration arrangement is
one ordered application migration history; approved module schemas own their tables.

## Background work

Use the same application operations and tenant/access model from jobs and HTTP.
A job's saved actor/tenant identifiers must not automatically confer permanent access;
define the execution authority and revocation behavior.

Decide queue library, transactional enqueue/outbox requirements, retries, idempotency,
and worker placement once the first concrete background operation is agreed.
PostgreSQL-backed jobs are a candidate; Redis caching does not select Redis as the queue.
A separate worker executable may be useful without adding a Compose service now.

A local rollback cannot undo a completed remote call. Provisioning or notifications
need explicit recovery for partial failures and duplicate delivery. No exactly-once
external side effects or cross-service rollback are promised.

See [audit](audit.md), [caching](caching.md), [deployment](deployment.md), and [testing](../testing.md).
