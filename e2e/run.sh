#!/usr/bin/env bash
# Runs the end-to-end suite against the running stack (docker compose up) in Playwright's image.
# The container joins the shared `proxy` network and maps the *.bool.test hosts the suite uses to
# Traefik's current address there (resolved each run, never hardcoded), and joins Compose's
# internal network so global-setup can reach Kratos's admin API. Its dependencies (package.json)
# are installed in the container, into the erp-e2e-node-modules volume, on the first run. EDITION picks which apps' specs
# run (apps/workspace/editions/<name>.ts, default full). Extra arguments go to `playwright test`,
# e.g. ./run.sh --project control-centre.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

TRAEFIK=$(docker network inspect proxy --format '{{range .Containers}}{{.Name}}{{"\n"}}{{end}}' | grep -m1 traefik || true)
TRAEFIK_IP=$(docker network inspect proxy --format "{{range .Containers}}{{if eq .Name \"${TRAEFIK}\"}}{{.IPv4Address}}{{end}}{{end}}" | cut -d/ -f1)
if [ -z "$TRAEFIK_IP" ]; then
  echo "error: no Traefik container found on the 'proxy' network — is the dev stack (docker compose up) running?" >&2
  exit 1
fi

hosts=()
for host in demo.bool.test admin.bool.test identity.bool.test; do
  hosts+=(--add-host="${host}:${TRAEFIK_IP}")
done

cid=$(docker create \
  --network proxy "${hosts[@]}" \
  -e EDITION="${EDITION:-full}" -e KRATOS_ADMIN_URL=http://kratos:4434 \
  -v "$(pwd)/..:/repo" -w /repo/e2e \
  -v erp-e2e-node-modules:/repo/e2e/node_modules \
  mcr.microsoft.com/playwright:v1.63.0-noble \
  sh -c 'test -x node_modules/.bin/playwright || npm install --no-save --no-package-lock --no-audit --no-fund >/dev/null
exec ./node_modules/.bin/playwright test "$@"' playwright "$@")
docker network connect erp_internal "$cid"
status=0
docker start -a "$cid" || status=$?
docker rm "$cid" >/dev/null
exit "$status"
