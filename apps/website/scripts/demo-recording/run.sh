#!/usr/bin/env bash
# Records the website hero's product demo from the running workspace and encodes it into
# apps/website/public/hero/demo/, with its chapter times in features/hero/demo-chapters.json (see
# record.mjs). Needs the dev stack up (docker compose up) and
# seeded (docker compose run --rm seed). Everything runs in containers: the take in Playwright's
# image on the shared proxy network (the *.bool.test hosts mapped to Traefik, as e2e/run.sh does),
# the encode in an ffmpeg image. Re-run whenever the workspace's screens change.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
web=$(cd ../.. && pwd)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

names=$(docker network inspect proxy --format '{{range .Containers}}{{.Name}}{{"\n"}}{{end}}')
TRAEFIK="${TRAEFIK_CONTAINER:-$(printf '%s\n' "$names" | grep -x traefik || printf '%s\n' "$names" | grep -m1 traefik || true)}"
TRAEFIK_IP=$(docker network inspect proxy --format "{{range .Containers}}{{if eq .Name \"${TRAEFIK}\"}}{{.IPv4Address}}{{end}}{{end}}" | cut -d/ -f1)
if [ -z "$TRAEFIK_IP" ]; then
  echo "error: no Traefik container on the 'proxy' network: is the dev stack (docker compose up) running?" >&2
  exit 1
fi

# `./run.sh screens`: still screens for the app grid (screens.mjs) instead of the recording
if [ "${1:-}" = "screens" ]; then
  docker run --rm --network proxy \
    --add-host="male-city.bool.test:${TRAEFIK_IP}" --add-host="identity.bool.test:${TRAEFIK_IP}" \
    -e DEMO_EMAIL -e DEMO_PASSWORD \
    -v "$(pwd):/rec" -w /rec -v erp-demo-recording-node-modules:/rec/node_modules -v "$work:/out" \
    mcr.microsoft.com/playwright:v1.63.0-noble@sha256:eff16c30e6f3f4af0a03fa4b706120d5e9b0891c344a27d64559aff5900a4a27 \
    sh -c 'test -d node_modules/@playwright || npm install --no-save --no-package-lock --no-audit --no-fund >/dev/null; exec node screens.mjs'
  mkdir -p "$web/public/apps"
  # WebP at 1600px wide: the largest a card shows them on a high-density screen
  docker run --rm -v "$work:/w" -w /w --entrypoint sh \
    linuxserver/ffmpeg:7.1.1@sha256:aea59a11c54291ac456bb2d67000445e5a8994f70bc3d96cdc29f022fbbf89fb -c '
    set -e
    for f in *.png; do ffmpeg -v error -y -i "$f" -vf "scale=1600:-1:flags=lanczos" -c:v libwebp -quality 86 "${f%.png}.webp"; done'
  cp "$work"/*.webp "$web/public/apps/"
  ls -la "$web/public/apps"
  exit 0
fi

echo "recording…"
docker run --rm --network proxy \
  --add-host="male-city.bool.test:${TRAEFIK_IP}" --add-host="identity.bool.test:${TRAEFIK_IP}" \
  -e DEMO_EMAIL -e DEMO_PASSWORD -e DEMO_DEBUG \
  -v "$(pwd):/rec" -w /rec -v erp-demo-recording-node-modules:/rec/node_modules -v "$work:/out" \
  mcr.microsoft.com/playwright:v1.63.0-noble@sha256:eff16c30e6f3f4af0a03fa4b706120d5e9b0891c344a27d64559aff5900a4a27 \
  sh -c 'test -d node_modules/@playwright || npm install --no-save --no-package-lock --no-audit --no-fund >/dev/null; exec node record.mjs'

echo "encoding…"
mkdir -p "$web/public/hero/demo"
# 30fps, sharp UI text, in two sizes: 2560×1600 for large high-density screens (a settled tablet on
# a 1920-wide Retina display is about 2600 device pixels across, and the camera zooms in), and
# 1600×1000 for phones and standard-density screens (demo.ts picks). Each as H.264 for every browser
# and VP9 for those that play it, both encoded from the captured frames (not one from the other);
# the first frame is the poster.
docker run --rm -v "$work:/w" -w /w --entrypoint sh \
  linuxserver/ffmpeg:7.1.1@sha256:aea59a11c54291ac456bb2d67000445e5a8994f70bc3d96cdc29f022fbbf89fb -c '
  set -e
  for size in 2560:1600: 1600:1000:-sm; do
    dims=${size%:*}; suffix=${size##*:}
    vf="fps=30,scale=${dims}:flags=lanczos,format=yuv420p"
    ffmpeg -v error -y -f concat -safe 0 -i frames.ffconcat -vf "$vf" \
      -c:v libx264 -preset slow -crf 22 -tune stillimage -movflags +faststart -an "demo${suffix}.mp4"
    ffmpeg -v error -y -f concat -safe 0 -i frames.ffconcat -vf "$vf" \
      -c:v libvpx-vp9 -b:v 0 -crf 34 -row-mt 1 -deadline good -cpu-used 2 -an "demo${suffix}.webm"
  done
  ffmpeg -v error -y -i demo.mp4 -frames:v 1 -q:v 3 poster.jpg'
cp "$work"/demo.mp4 "$work"/demo.webm "$work"/demo-sm.mp4 "$work"/demo-sm.webm "$work/poster.jpg" "$web/public/hero/demo/"
# the chapter times the hero's captions follow (features/hero/demo.ts)
cp "$work/chapters.json" "$web/features/hero/demo-chapters.json"
ls -la "$web/public/hero/demo"
