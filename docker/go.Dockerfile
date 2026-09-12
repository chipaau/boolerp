# Go dev image. Backend runs entirely in Docker (host Go not required).
# One-shot commands (migrate, test) use `go run` (fast, reliable). The long-running `api` service
# builds then `exec`s the binary instead (see compose.yaml) — `go run` never forwards SIGTERM to
# its spawned child, which would silently skip graceful shutdown entirely. Hot-reload (air) can be
# added later via the same prebuilt-binary approach.
FROM golang:1.27-alpine

RUN apk add --no-cache git

WORKDIR /w/apps/api
