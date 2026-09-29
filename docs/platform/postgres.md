# PostgreSQL foundation

Status: target contract for platform step 3; the implementation was removed for
the rebuild (C24). Application persistence and tables remain unapproved. PostgreSQL is the only selected application database.

## Runtime pool and readiness

**Rebuild status (step 3a):** `internal/platform/postgres.NewPool` builds the pool
from the separate `APP_DB_*` settings (C43) and `APP_DB_MAX_CONNS` (C42), building the
connection URL with `net/url` so the password needs no escaping. It does not connect: pgxpool opens
connections on first use, so the API starts and answers liveness while PostgreSQL
is down. `main` closes the pool with a deferred `Close`, which runs after the HTTP
server has shut down. Settings pgx cannot use fail startup with a fixed message;
pgx's parse error is not wrapped because its password redaction is best effort.
Other pool settings keep pgx defaults. TLS defaults to `verify-full`; Compose uses
`disable` because the local server has no certificate. Readiness is step 3b.

Target contract from the removed implementation:

The API creates one pgx/v5 `pgxpool` during bootstrap and closes it after HTTP
shutdown. Pool construction validates the connection string but is lazy: it does
not block liveness while PostgreSQL is unavailable. `GET /api/healthz` remains a
process liveness check. `GET /api/readyz` performs a bounded PostgreSQL ping and
returns `503` with a safe problem response while the database is unavailable.
The ping uses the request context and `APP_DB_PING_TIMEOUT` (2 seconds by default).

`APP_DB_MAX_CONNS` defaults to 20. Pool errors returned to callers omit the DSN
and raw server details. Do not include database URLs, passwords, query values,
or unredacted driver errors in logs.

## Migration command

`cmd/migrate` applies ordered Goose SQL migrations embedded in the same API
release. Migrations run explicitly; the API never runs them during startup.
The command reads `MIGRATE_DSN`, observes SIGINT/SIGTERM, and has a five-minute
deadline. It reports failure without logging driver error text that might include
SQL or database values.

No application tables or SQL migrations are included in this step. Goose keeps
its migration-version table in a private `migrations` schema, which the runtime
role cannot access. Approve each
application table individually in the [data-model checklist](../data-model/README.md)
before adding a migration or query for it. pgxpool and Goose are selected for
this foundation; sqlc remains deferred until an approved table needs generated
queries.

## Database roles

On a new, empty Compose PostgreSQL volume, the initialization script creates:

- The cluster owner from `POSTGRES_USER`/`POSTGRES_PASSWORD`, used only for
  initialization and administration.
- The `POSTGRES_MIGRATE_USER` role, which can connect and create objects in the
  `public` schema and owns the private `migrations` schema. Goose migrations use
  `MIGRATE_DSN`; application objects go in `public`, and migration history stays
  in `migrations`.
- The `POSTGRES_APP_USER` runtime role, which can connect and use `public` but
  cannot create schema objects or manage roles. Default grants give it
  select/insert/update/delete on future migration-owned tables and `USAGE` on
  their sequences; it cannot call `setval` to change sequence values. It also
  cannot access the migration-history schema or table.

Compose passes the API only its explicit `APP_*` settings, including the runtime role's `APP_DB_*`; it does
not pass the cluster-owner password or migration DSN. Supply `MIGRATE_DSN` only
to the explicit migration command. Replace example passwords outside local
development, and keep each DSN in sync with its role credentials.

The PostgreSQL image runs initialization scripts only when its data directory is
first created. Existing volumes are preserved and are not modified or reset by
this implementation. An existing installation must have an administrator
provision and verify the two restricted roles and grants before configuring `APP_DB_USER`.
The initialization script is idempotent for missing roles but deliberately does
not reset existing role passwords.

## Running migrations

For the local development container, pass the migration DSN only to this one-off
command:

```sh
docker compose --env-file .env run --rm --no-deps \
  -e MIGRATE_DSN --entrypoint go api run ./cmd/migrate
```

The API container starts with the runtime role. Database readiness proves
connectivity only; it does not prove that application tables or migrations have
been approved or installed.

See [transactions and background execution](execution.md), [development](../development.md),
and the [sequential roadmap](../roadmap.md).
