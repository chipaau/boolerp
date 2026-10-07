#!/usr/bin/env bash
# Runs the end-to-end suite against the running stack (docker compose up) in Playwright's image.
# The container joins the shared `proxy` network and maps the *.bool.test hosts the suite uses to
# Traefik's current address there (resolved each run, never hardcoded). Its dependencies
# (package.json) are installed in the container, into the erp-e2e-node-modules volume, on the
# first run. EDITION picks which apps' specs run (apps/workspace/editions/<name>.ts, default full). Extra arguments go to `playwright test`,
# e.g. ./run.sh --project control-centre.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

# An exact "traefik" first: the shared dev-machine proxy brings companions onto this network whose
# names also contain "traefik" (traefik-proxy-whoami-1, traefik-proxy-dnsmasq-1), and a plain
# first-match picked whichever Docker listed first — pointing the whole suite at an echo server, with
# every spec failing on a page that was never the app. TRAEFIK_CONTAINER overrides both.
names=$(docker network inspect proxy --format '{{range .Containers}}{{.Name}}{{"\n"}}{{end}}')
TRAEFIK="${TRAEFIK_CONTAINER:-$(printf '%s\n' "$names" | grep -x traefik || printf '%s\n' "$names" | grep -m1 traefik || true)}"
TRAEFIK_IP=$(docker network inspect proxy --format "{{range .Containers}}{{if eq .Name \"${TRAEFIK}\"}}{{.IPv4Address}}{{end}}{{end}}" | cut -d/ -f1)
if [ -z "$TRAEFIK_IP" ]; then
  echo "error: no Traefik container found on the 'proxy' network — is the dev stack (docker compose up) running?" >&2
  exit 1
fi

hosts=()
for host in male-city.bool.test admin.bool.test identity.bool.test; do
  hosts+=(--add-host="${host}:${TRAEFIK_IP}")
done

# compile the first pages before the tests start timing them
./warm.sh

cid=$(docker create \
  --network proxy "${hosts[@]}" \
  -e EDITION="${EDITION:-full}" \
  -v "$(pwd)/..:/repo" -w /repo/e2e \
  -v erp-e2e-node-modules:/repo/e2e/node_modules \
  mcr.microsoft.com/playwright:v1.63.0-noble@sha256:eff16c30e6f3f4af0a03fa4b706120d5e9b0891c344a27d64559aff5900a4a27 \
  sh -c 'test -x node_modules/.bin/playwright || npm install --no-save --no-package-lock --no-audit --no-fund >/dev/null
exec ./node_modules/.bin/playwright test "$@"' playwright "$@")
status=0
docker start -a "$cid" || status=$?
docker rm "$cid" >/dev/null
exit "$status"
