# Tenancy rules

Read [platform/tenancy.md](../../docs/platform/tenancy.md).

- A tenant is one customer organisation (C115): never a department, site, or legal
  entity. A parent sees nothing inside a child; it may publish read-only datasets to its
  descendants, which apps let children copy or reference. Exchange tables (C117) let a
  named counterparty read a row its owner alone writes. Nothing else crosses tenants
  without an explicit, audited grant.
- People have one account and a membership per tenant; membership is not employment.
  Operators are members of the single operator tenant (`tenants.is_operator`); they
  manage tenant records but cannot read other tenants' data without an audited grant.
  The flag is never set through an API.
- Isolation is shared tables with `tenant_id` and row-level security (C115); the policy
  details are settled with the first tenancy tables.
- Never treat a hostname or client-supplied tenant identifier as proof of access.
- Apply the eventual tenant boundary to database operations, caches, jobs, and audit reads.
- With row-level security, distinguish read visibility from insert/update/delete
  permissions and test as the restricted runtime role.
- Do not copy historical visible-set policies, table DDL, or ltree conventions into the current design.
