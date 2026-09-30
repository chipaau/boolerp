#!/usr/bin/env bash
# Creates Kratos's own database and role (C85) on first start with an empty volume.
# Kratos owns only this database and runs its own migrations in it; the API's
# roles cannot connect to it, and Kratos's role cannot connect to the API's.
# Skipped when POSTGRES_KRATOS_USER is unset (for example CI's PostgreSQL, which
# runs no Kratos).
set -Eeuo pipefail

if [[ -z "${POSTGRES_KRATOS_USER:-}" ]]; then
	exit 0
fi
# The entrypoint sources this script, so the image's file_env helper is available
# (as in 10-roles.sh, C80).
file_env POSTGRES_KRATOS_PASSWORD
: "${POSTGRES_KRATOS_PASSWORD:?POSTGRES_KRATOS_PASSWORD or its _FILE is required}"

psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set=ON_ERROR_STOP=1 <<'SQL'
\getenv kratos_role POSTGRES_KRATOS_USER
\getenv kratos_password POSTGRES_KRATOS_PASSWORD

SELECT format(
    'CREATE ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT PASSWORD %L',
    :'kratos_role', :'kratos_password'
)
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = :'kratos_role')
\gexec

SELECT format('CREATE DATABASE kratos OWNER %I', :'kratos_role')
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'kratos')
\gexec

-- New databases let PUBLIC connect; only Kratos's role (the owner) may. The
-- API's database likewise admits only its own roles (database-setup.psql).
REVOKE ALL ON DATABASE kratos FROM PUBLIC;
SQL
