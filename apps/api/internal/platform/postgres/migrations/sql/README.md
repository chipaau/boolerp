# Application migrations

Goose SQL migrations for the application schema, applied in version order by
`cmd/migrate` and embedded in the release binary (C46).

- Name files `NNNNN_description.sql` with a zero-padded, increasing version,
  for example `00001_create_tenants.sql`.
- Write only a `-- +goose Up` section. Migrations are forward-only: fix a mistake
  with a new migration, never by editing an applied one.
- Add a migration only for a table approved in the
  [data-model checklist](../../../../../../../docs/data-model/README.md).
- Objects go in the `public` schema. The runtime role receives read/write access
  to new tables and sequences through default privileges; it cannot change the
  schema. Goose's history lives in the private `migrations` schema.

There are no application migrations yet. When the first module table is approved,
migrations move to per-module folders with per-module history tables (C48) and
this folder is removed.
