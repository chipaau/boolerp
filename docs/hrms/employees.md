# HRMS employee records

Status: business scope confirmed; employee model, tables, and operations open.

Employee records are the only business functionality in this iteration. Their purpose
is also to prove the platform backbone with one complete, useful operation.

## Proposed conceptual separation

An employee is an HRMS business record. A user is an authentication identity.
A membership grants access to a tenant. The proposed model permits employees without
logins and users without employee records; any linkage must be explicitly designed.

No primary-key, national-identity, email uniqueness, status enum, employment-date,
soft-delete, or mandatory Dhivehi-field rule is approved yet.

## Candidate operations

Create, update, retrieve, and list employees were used as examples in architecture
discussion. Confirm their exact scope, permissions, fields, lifecycle, validation,
concurrency behavior, and API contract before implementation.

Domain code owns employee invariants and allowed changes. Application code owns
operation orchestration and access requirements. HTTP/PostgreSQL adapters translate
transport and persistence representations.

## First operation acceptance proposal

The initial approved operation should exercise authentication, tenant access,
authorization, domain validation, persistence, business audit, and a correlated trace.
A suitable read operation can then demonstrate Redis caching and invalidation.
Do not add caching to a write merely to claim it is integrated.

Test unauthorized and cross-tenant access, transaction rollback, failed audit,
concurrent conflicts where applicable, and the relevant cache consistency behavior.

See [request lifecycle](../architecture/request-lifecycle.md),
[data-model status](../data-model/README.md), and [decision register](../decisions/README.md).
