#!/usr/bin/env bash
# Runs the Playwright suite against the real running stack (docker compose up), not an ephemeral
# instance — there's no self-contained way to spin up Traefik + *.bool.test routing per run the
# way the Go suite spins up its own Postgres via Testcontainers.
#
# A plain `docker run` container isn't on the shared external `proxy` network compose's app/admin/
# api services join, so *.bool.test doesn't resolve/route from inside it by default. This attaches
# to that network and maps each *.bool.test host this suite uses to Traefik's current address on
# it (resolved fresh each run — it's a dynamic address, never hardcode it).
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

TRAEFIK_IP=$(docker network inspect proxy --format '{{range .Containers}}{{if eq .Name "traefik"}}{{.IPv4Address}}{{end}}{{end}}' | cut -d/ -f1)
if [ -z "$TRAEFIK_IP" ]; then
  echo "error: no 'traefik' container found on the 'proxy' network — is the dev stack (docker compose up) running?" >&2
  exit 1
fi

docker run --rm \
  --network proxy \
  --add-host="admin.bool.test:${TRAEFIK_IP}" \
  --add-host="malecouncil.bool.test:${TRAEFIK_IP}" \
  -v "$(pwd)/..:/repo" \
  -w /repo/e2e \
  mcr.microsoft.com/playwright:v1.63.0-noble \
  ./node_modules/.bin/playwright test --reporter=list "$@"
