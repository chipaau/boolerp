#!/usr/bin/env bash
# Starts Cerbos on the "ci" network for the API feature tests (C155), with the
# edition's policies assembled by cmd/policies and the same configuration as
# compose.yaml. Feature tests reach it at cerbos:3593 (CERBOS_TEST_ADDR).
# GO_IMAGE and CERBOS_IMAGE default to the images CI pins; GO_MOD_CACHE, when set,
# is mounted as the module cache.
set -euo pipefail

go_image="${GO_IMAGE:-golang:1.27}"
cerbos_image="${CERBOS_IMAGE:-ghcr.io/cerbos/cerbos:0.56.0}"
policies="$(mktemp -d)"
cache=()
if [[ -n "${GO_MOD_CACHE:-}" ]]; then
  cache=(-v "$GO_MOD_CACHE:/go/pkg/mod")
fi

docker network create ci >/dev/null 2>&1 || true
docker run --rm -v "$PWD/apps/api:/src" ${cache[@]+"${cache[@]}"} -v "$policies:/out" -w /src "$go_image" \
  go run ./cmd/policies -out /out/policies
chmod -R a+rX "$policies"

docker run -d --name cerbos --network ci --user 65532:65532 --read-only \
  -v "$PWD/docker/cerbos/config.yaml:/etc/cerbos/config.yaml:ro" \
  -v "$policies/policies:/policies:ro" \
  "$cerbos_image" server --config=/etc/cerbos/config.yaml >/dev/null

for _ in $(seq 1 60); do
  if docker exec cerbos /cerbos healthcheck --config=/etc/cerbos/config.yaml >/dev/null 2>&1; then
    exit 0
  fi
  sleep 1
done
docker logs cerbos
exit 1
