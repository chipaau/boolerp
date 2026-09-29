#!/usr/bin/env bash
set -Eeuo pipefail

: "${POSTGRES_APP_USER:?POSTGRES_APP_USER is required}"
: "${POSTGRES_APP_PASSWORD:?POSTGRES_APP_PASSWORD is required}"
: "${POSTGRES_MIGRATE_USER:?POSTGRES_MIGRATE_USER is required}"
: "${POSTGRES_MIGRATE_PASSWORD:?POSTGRES_MIGRATE_PASSWORD is required}"

if [[ "$POSTGRES_USER" == "$POSTGRES_APP_USER" || "$POSTGRES_USER" == "$POSTGRES_MIGRATE_USER" || "$POSTGRES_APP_USER" == "$POSTGRES_MIGRATE_USER" ]]; then
	printf '%s\n' 'PostgreSQL owner, runtime, and migration roles must be distinct.' >&2
	exit 1
fi

psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set=ON_ERROR_STOP=1 <<'SQL'
\getenv app_role POSTGRES_APP_USER
\getenv app_password POSTGRES_APP_PASSWORD
\getenv migration_role POSTGRES_MIGRATE_USER
\getenv migration_password POSTGRES_MIGRATE_PASSWORD

SELECT format(
    'CREATE ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT PASSWORD %L',
    :'app_role', :'app_password'
)
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = :'app_role')
\gexec

SELECT format(
    'CREATE ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT PASSWORD %L',
    :'migration_role', :'migration_password'
)
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = :'migration_role')
\gexec

-- PostgreSQL 15+ already denies CREATE on public to PUBLIC; stating it keeps the
-- runtime role unable to create objects on any server version.
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

SELECT format('GRANT CONNECT ON DATABASE %I TO %I', current_database(), :'app_role')
\gexec
SELECT format('GRANT USAGE ON SCHEMA public TO %I', :'app_role')
\gexec

SELECT format('GRANT CONNECT ON DATABASE %I TO %I', current_database(), :'migration_role')
\gexec
SELECT format('GRANT USAGE, CREATE ON SCHEMA public TO %I', :'migration_role')
\gexec
SELECT format('CREATE SCHEMA %I AUTHORIZATION %I', 'migrations', :'migration_role')
WHERE NOT EXISTS (SELECT FROM pg_namespace WHERE nspname = 'migrations')
\gexec
REVOKE ALL ON SCHEMA migrations FROM PUBLIC;
SELECT format(
    'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO %I',
    :'migration_role', :'app_role'
)
\gexec
SELECT format(
    'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT USAGE ON SEQUENCES TO %I',
    :'migration_role', :'app_role'
)
\gexec
SQL
