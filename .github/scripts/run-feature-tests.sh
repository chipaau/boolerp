#!/usr/bin/env bash
# Runs the API feature tests (C77, C79) against the PostgreSQL and Redis started by
# start-postgres.sh and a "redis" container on the "ci" network:
#   1. migrate the suite database once, with the real migrate command;
#   2. run every TestFeature* test.
# GO_IMAGE defaults to golang:1.27; GO_MOD_CACHE, when set, is mounted as the module cache.
set -euo pipefail

image="${GO_IMAGE:-golang:1.27}"
secrets="${SECRETS_DIR:-${RUNNER_TEMP:-/tmp}/erp-secrets}" # written by start-postgres.sh
cache=()
if [[ -n "${GO_MOD_CACHE:-}" ]]; then
  cache=(-v "$GO_MOD_CACHE:/go/pkg/mod")
fi

docker run --rm --network ci -v "$PWD/apps/api:/src" ${cache[@]+"${cache[@]}"} -w /src \
  -e MIGRATE_DB_HOST=postgres -e MIGRATE_DB_NAME=erp -e MIGRATE_DB_USER=erp_migrate \
  -e MIGRATE_DB_PASSWORD_FILE=/run/secrets/db_migrate_password -e MIGRATE_DB_SSLMODE=disable \
  -v "$secrets:/run/secrets:ro" \
  "$image" go run ./cmd/migrate

docker run --rm --network ci -v "$PWD/apps/api:/src" ${cache[@]+"${cache[@]}"} -w /src \
  -e POSTGRES_TEST_HOST=postgres -e POSTGRES_TEST_DB=erp -e POSTGRES_TEST_PLATFORM_DB=erp_platform \
  -e POSTGRES_TEST_APP_USER=erp_app -e POSTGRES_TEST_APP_PASSWORD="$PGPASS_APP" \
  -e POSTGRES_TEST_MIGRATE_USER=erp_migrate -e POSTGRES_TEST_MIGRATE_PASSWORD="$PGPASS_MIGRATE" \
  -e REDIS_TEST_HOST=redis \
  "$image" go test -race -tags feature -run '^TestFeature' ./...
