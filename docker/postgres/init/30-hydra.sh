#!/usr/bin/env bash
# Creates Hydra's own database and role (C85, C89) on first start with an empty volume.
# Hydra owns only this database and runs its own migrations in it; the API's
# roles cannot connect to it, and Hydra's role cannot connect to the API's.
# Skipped when POSTGRES_HYDRA_USER is unset (for example CI's PostgreSQL, which
# runs no Hydra).
set -Eeuo pipefail

if [[ -z "${POSTGRES_HYDRA_USER:-}" ]]; then
	# return, not exit: the entrypoint sources this script, so exit would end the
	# entrypoint itself and PostgreSQL would never finish initialising.
	return 0
fi
# The entrypoint sources this script, so the image's file_env helper is available
# (as in 10-roles.sh, C80).
file_env POSTGRES_HYDRA_PASSWORD
: "${POSTGRES_HYDRA_PASSWORD:?POSTGRES_HYDRA_PASSWORD or its _FILE is required}"

psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set=ON_ERROR_STOP=1 <<'SQL'
\getenv hydra_role POSTGRES_HYDRA_USER
\getenv hydra_password POSTGRES_HYDRA_PASSWORD

SELECT format(
    'CREATE ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT PASSWORD %L',
    :'hydra_role', :'hydra_password'
)
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = :'hydra_role')
\gexec

SELECT format('CREATE DATABASE hydra OWNER %I', :'hydra_role')
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'hydra')
\gexec

-- New databases let PUBLIC connect; only Hydra's role (the owner) may. The
-- API's database likewise admits only its own roles (database-setup.psql).
REVOKE ALL ON DATABASE hydra FROM PUBLIC;
SQL
