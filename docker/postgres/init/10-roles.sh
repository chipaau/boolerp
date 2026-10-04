#!/usr/bin/env bash
set -Eeuo pipefail

# The entrypoint sources this script (it is not executable), so the image's
# file_env helper is available: it sets X from the file X_FILE names, and fails
# if both are set, as for POSTGRES_PASSWORD (C80).
file_env POSTGRES_APP_PASSWORD
file_env POSTGRES_MIGRATE_PASSWORD

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

-- erp_lookup (C131) owns the narrow functions that must read past row-level
-- security, such as which tenant owns a host or whether a tenant is the operator.
-- No one can log in as it; creating a BYPASSRLS role needs a superuser, which is
-- why it is made here and not in a migration. The migration role is a member only
-- so its migrations can create those functions as erp_lookup.
SELECT 'CREATE ROLE erp_lookup NOLOGIN NOINHERIT BYPASSRLS'
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'erp_lookup')
\gexec
SELECT format('GRANT erp_lookup TO %I', :'migration_role')
\gexec

SQL

# Grants, the private migrations schema, and default privileges are per database;
# the same file prepares extra databases, such as the test platform database.
psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set=ON_ERROR_STOP=1 \
	--file /docker-entrypoint-initdb.d/database-setup.psql
