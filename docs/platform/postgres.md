# PostgreSQL foundation

Status: implemented (steps 3a-3c). PostgreSQL is the only selected application
database; the confirmed tables are in the [data model](../data-model/README.md).

## Runtime pool and readiness

**Status (step 3a):** `internal/platform/kit/postgres.NewPool` builds the pool
from the separate `APP_DB_*` settings (C43) and `APP_DB_MAX_CONNS` (C42), building the
connection URL with `net/url` so the password needs no escaping. It does not connect: pgxpool opens
connections on first use, so the API starts and answers liveness while PostgreSQL
is down. `main` closes the pool with a deferred `Close`, which runs after the HTTP
server has shut down. Settings pgx cannot use fail startup with a fixed message;
pgx's parse error is not wrapped because its password redaction is best effort.
Other pool settings keep pgx defaults. TLS defaults to `verify-full`; Compose uses
`disable` because the local server has no certificate.

**Status (step 3b):** `GET /api/readyz` pings PostgreSQL through the pool
within `APP_DB_PING_TIMEOUT` and answers `{"status":"ready"}` or a 503 problem
response (C45). The router receives only a check function, so other dependencies
can join the check without changing the handler. The failure cause is logged, not
returned. The Compose health check stays on `/api/healthz`.

`APP_DB_MAX_CONNS` defaults to 20. Pool errors returned to callers omit the DSN
and raw server details. Do not include database URLs, passwords, query values,
or unredacted driver errors in logs.

## Migration command

**Status (step 3c):** `cmd/migrate` (C46, C47) loads only `MIGRATE_DB_*`,
pings PostgreSQL (so wrong credentials fail even with nothing to apply), takes a
PostgreSQL advisory lock so concurrent runs apply each migration once, and applies
pending migrations of each module in the build's edition (C95), in the edition's
order: each package embeds its own `migrations` folder (`internal/platform/<name>` or
`internal/modules/<name>`, C122) and has
its own history table, `migrations.<module>_version` (C48). Migrations are forward-only (no
down command). A failure reports the migration file, PostgreSQL's message, and
SQLSTATE code, never the statement text or PostgreSQL's detail, which can contain
row values. SIGINT/SIGTERM cancel the run; the overall deadline is five minutes.
Logs are JSON through the application logger, with the module's name. The migrations
so far are `reference`'s `countries` and `identity`'s `users` (with its row-level
security, C126).

Migrations run explicitly, never at API startup, and are embedded in the same
release. Goose keeps its history tables in a private `migrations` schema, which the
runtime role cannot access. Each table's fields are confirmed before its migration is
written (C121). sqlc is selected for queries (C116) but not used yet: the `users` store
is hand-written pgx.

## Database roles

On a new, empty Compose PostgreSQL volume, the initialization script creates:

- The cluster owner from `POSTGRES_USER` and the `postgres_password` file, used only for
  initialization and administration.
- The `POSTGRES_MIGRATE_USER` role, which can connect and create objects in the
  `public` schema and owns the private `migrations` schema. Goose migrations use
  `MIGRATE_DB_*`; application objects go in `public`, and migration history stays
  in `migrations`.
- The `POSTGRES_APP_USER` runtime role, which can connect and use `public` but
  cannot create schema objects or manage roles. Default grants give it
  select/insert/update/delete on future migration-owned tables and `USAGE` on
  their sequences; it cannot call `setval` to change sequence values. It also
  cannot access the migration-history schema or table.
- The `erp_lookup` role (C131, added with the first tenancy tables): `NOLOGIN BYPASSRLS`,
  so no one connects as it. It owns the tenant lookup function and has column-level
  `SELECT` only on the columns that lookup reads. Creating a `BYPASSRLS` role needs a
  superuser, so the initialization script (and a self-hosted install) creates it; the
  migration role is a member only so it can give the function to it.

Compose passes the API only its explicit `APP_*` settings, including the runtime role's `APP_DB_*`; it does
not pass the cluster-owner password or migration settings. Passwords are Compose
secrets read from `docker/secrets/dev` and mounted as files under
`/run/secrets` (C80): PostgreSQL
reads `POSTGRES_PASSWORD_FILE` itself, and `10-roles.sh` reads
`POSTGRES_APP_PASSWORD_FILE` and `POSTGRES_MIGRATE_PASSWORD_FILE` with the image's
`file_env` helper. CI mounts the same committed files. Supply `MIGRATE_DB_*` only
to the explicit migration command. Replace example passwords outside local
development, and keep each DSN in sync with its role credentials.

The PostgreSQL image runs initialization scripts only when its data directory is
first created. Existing volumes are preserved and are not modified or reset by
this implementation. An existing installation must have an administrator
provision and verify the two restricted roles and grants before configuring `APP_DB_USER`.
The initialization script is idempotent for missing roles but deliberately does
not reset existing role passwords. Per-database setup (revoking `CREATE` on `public`,
the connect and usage grants, the `migrations` schema, and default privileges) lives in
`docker/postgres/init/database-setup.psql`, so another database (such as the feature
tests' `erp_platform`, C79) gets identical grants with
`psql -d <database> -f database-setup.psql`.

## Running migrations

For local development, the `migrate` Compose service (profile `tools`, so
`docker compose up` does not start it) runs `cmd/migrate` as the migration role. It
and `seed` (which writes the seed files, C137) are the only services given that
role's password, as the file `/run/secrets/db_migrate_password` (C80):

```sh
docker compose run --rm migrate
```

In a deployment, run the release image's migrate command before starting the new
API version (see [deployment](deployment.md)):

```sh
docker run --rm --entrypoint /usr/local/bin/migrate -e MIGRATE_DB_HOST=... <api image>
```

The API container starts with the runtime role. Database readiness proves
connectivity only; it does not prove that application tables or migrations have
been approved or installed.

See [transactions and background execution](execution.md), [development](../development.md),
and the [sequential roadmap](../roadmap.md).
