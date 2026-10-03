# Employee operation lifecycle

Status: proposed explanation of the selected hexagonal direction.
Employee fields, concrete endpoints, and transaction interfaces are not approved.

## Example: create an employee

1. HTTP infrastructure starts request correlation/tracing. Identity and tenancy
   capabilities establish the caller and tenant context using the eventual approved model.
2. The HRMS HTTP adapter decodes input, checks transport shape, and builds an
   application command. It does not infer permission from an input tenant identifier.
3. The application operation enforces tenant access and authorization through its
   dependencies. A non-HTTP caller must satisfy equivalent requirements.
4. The domain constructs or changes an employee and checks its business invariants.
   This creates or updates an in-memory object; it performs no SQL.
5. The application defines the work that must succeed atomically. The proposed
   transaction port supplies transaction-bound persistence and audit dependencies.
6. The PostgreSQL adapter persists the employee and required successful-change audit
   record in the same transaction. Its tenant settings (row-level security, C115, C116)
   are transaction-local. Database constraints handle concurrent integrity races.
7. A successful commit allows cache invalidation/update and the operation's success
   result. A rollback must not publish a cache entry for uncommitted data.
8. The HTTP adapter maps application errors/results into the approved HTTP contract.
   Request tracing records technical execution independently of the business audit trail.

A failure to commit is not success. Cache invalidation failure after a successful
database commit also needs an explicit policy; it cannot be represented as a database
rollback. The cache design must bound stale data and specify recovery.

## Updates and reads

An update use case loads an employee through its persistence port, invokes a domain
method, and persists the authorized change under the agreed concurrency policy.
The HTTP adapter does not mutate database models directly.

A list/read use case can return an application read model without constructing a rich
domain entity for every row. Cached results must be scoped to the tenant, query, and
applicable visibility. A cache hit is not authorization.

## Boundary examples

| Concern | Home |
| --- | --- |
| Invalid JSON or field type | HTTP adapter |
| Invalid employee state/change | Domain |
| Caller may perform this action | Application operation using authorization |
| Unique identifier under concurrent writes | Database constraint, mapped by persistence adapter |
| Atomic change plus business audit | Application transaction contract and database adapters |
| Cache serialization and Redis commands | Cache adapter |
| Trace spans and request log correlation | Observability infrastructure/instrumentation |

A database rollback cannot undo a remote identity call, email, or other external
side effect. Durable jobs, retries, and recovery states must be designed where
such effects are required; no exactly-once delivery is assumed.

See [execution](../platform/execution.md), [audit](../platform/audit.md),
[caching](../platform/caching.md), and [testing](../testing.md).
