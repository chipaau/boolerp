#!/usr/bin/env bash
# Opens the pages the suite reaches first, so the development servers (Next.js and Vite
# compile on first request) have compiled them before any test is timed. A cold page, the
# login service's settings and logout pages in particular, could otherwise take longer
# than a test's 15-second wait. Used by run.sh and CI. With E2E_TRAEFIK set (CI: the
# address of Traefik), requests go there with the site's Host header; otherwise the
# *.bool.test names are resolved as usual.
set -u

pages=(
  identity.bool.test/login
  identity.bool.test/
  identity.bool.test/settings
  "identity.bool.test/logout/confirm?logout_challenge=warm-up"
  demo.bool.test/
  admin.bool.test/
)

for page in "${pages[@]}"; do
  host=${page%%/*}
  path=/${page#*/}
  if [[ -n "${E2E_TRAEFIK:-}" ]]; then
    curl -s -o /dev/null --max-time 120 -H "Host: $host" "http://$E2E_TRAEFIK$path" || true
  else
    curl -s -o /dev/null --max-time 120 "http://$host$path" || true
  fi
done
