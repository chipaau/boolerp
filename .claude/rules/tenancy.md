# Tenancy rules

Read [platform/tenancy.md](../../docs/platform/tenancy.md).

- Do not assume a tenant is a licensed customer, legal entity, department, or hierarchy
  node until the tenant model is confirmed.
- PostgreSQL is selected; the isolation layout and parent visibility semantics are open.
- Never treat a hostname or client-supplied tenant identifier as proof of access.
- Apply the eventual tenant boundary to database operations, caches, jobs, and audit reads.
- If pooled RLS is selected, distinguish read visibility from insert/update/delete
  permissions and test as the restricted runtime role.
- Do not copy historical visible-set policies, table DDL, or ltree conventions into the rebuild.
