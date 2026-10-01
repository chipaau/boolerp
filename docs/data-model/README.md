# Data model status

Updated: 2026-10-01.
Status: open. No tables are approved for the new API. (A `sessions` table was approved
for sessions in PostgreSQL and withdrawn when sessions moved to the BFF's Redis, C90.)

The previous foundation DDL and wider schemas are archived. They are not a starting
schema, and their old approval labels do not apply to this rebuild.

Review each required table with its purpose, ownership, columns/types, keys,
constraints, tenant scope, relationships, lifecycle, sensitive fields, and
relevant concurrency requirements. Record explicit approval before writing
migrations or queries against that table.

Tenant semantics and the isolation model must be settled before approving
tenant-scoped employee persistence. UUID versions, identifier formats, soft
deletion, hierarchy storage, bilingual fields, and identity linkage are not
automatically inherited.

See [tenancy](../platform/tenancy.md), [HRMS employees](../hrms/employees.md),
and [the decision register](../decisions/README.md).
