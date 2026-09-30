#!/usr/bin/env bash
# Starts a throwaway PostgreSQL 18 on the Docker network "ci", initialized by the
# same roles script as Compose, so tests prove the real privilege model (C77).
# Passwords come from PGPASS_OWNER, PGPASS_APP, and PGPASS_MIGRATE, and are passed
# as files (C80), written to SECRETS_DIR (default $RUNNER_TEMP/erp-secrets or
# /tmp/erp-secrets); run-feature-tests.sh and the image job read the same files.
#
# Two databases (C79):
#   erp           the suite database; run-feature-tests.sh migrates it once, and
#                 tests work in transactions that are rolled back.
#   erp_platform  prepared with the same role setup but never migrated, for tests
#                 of the migrator, role privileges, and concurrency.
set -euo pipefail

secrets="${SECRETS_DIR:-${RUNNER_TEMP:-/tmp}/erp-secrets}"
mkdir -p "$secrets"
# printf, not echo: a trailing newline would become part of the password.
printf '%s' "$PGPASS_OWNER" >"$secrets/postgres_password"
printf '%s' "$PGPASS_APP" >"$secrets/db_app_password"
printf '%s' "$PGPASS_MIGRATE" >"$secrets/db_migrate_password"
# Readable by the containers' non-root users (throwaway test passwords).
chmod 0644 "$secrets"/*

docker network create ci >/dev/null 2>&1 || true
docker run -d --name postgres --network ci \
  -e POSTGRES_USER=erp -e POSTGRES_DB=erp \
  -e POSTGRES_APP_USER=erp_app -e POSTGRES_MIGRATE_USER=erp_migrate \
  -e POSTGRES_PASSWORD_FILE=/run/secrets/postgres_password \
  -e POSTGRES_APP_PASSWORD_FILE=/run/secrets/db_app_password \
  -e POSTGRES_MIGRATE_PASSWORD_FILE=/run/secrets/db_migrate_password \
  -v "$secrets:/run/secrets:ro" \
  -v "$PWD/docker/postgres/init:/docker-entrypoint-initdb.d:ro" \
  postgres:18 >/dev/null

for _ in $(seq 1 60); do
  if docker logs postgres 2>&1 | grep -q "PostgreSQL init process complete" &&
    docker exec postgres pg_isready -h 127.0.0.1 -U erp >/dev/null; then
    docker exec postgres psql -q -U erp -d erp -c "CREATE DATABASE erp_platform"
    docker exec postgres psql -q -U erp -d erp_platform \
      -f /docker-entrypoint-initdb.d/database-setup.psql
    exit 0
  fi
  sleep 1
done
docker logs postgres
exit 1
