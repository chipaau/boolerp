#!/usr/bin/env bash
# Starts a throwaway PostgreSQL 18 on the Docker network "ci", initialized by the
# same roles script as Compose, so tests prove the real privilege model (C77).
# Passwords come from PGPASS_OWNER, PGPASS_APP, and PGPASS_MIGRATE.
#
# Two databases (C79):
#   erp           the suite database; run-feature-tests.sh migrates it once, and
#                 tests work in transactions that are rolled back.
#   erp_platform  prepared with the same role setup but never migrated, for tests
#                 of the migrator, role privileges, and concurrency.
set -euo pipefail

docker network create ci >/dev/null 2>&1 || true
docker run -d --name postgres --network ci \
  -e POSTGRES_USER=erp -e POSTGRES_PASSWORD="$PGPASS_OWNER" -e POSTGRES_DB=erp \
  -e POSTGRES_APP_USER=erp_app -e POSTGRES_APP_PASSWORD="$PGPASS_APP" \
  -e POSTGRES_MIGRATE_USER=erp_migrate -e POSTGRES_MIGRATE_PASSWORD="$PGPASS_MIGRATE" \
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
