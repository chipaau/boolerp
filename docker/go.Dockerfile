# Go DEV image. Backend runs entirely in Docker (host Go not required).
# One-shot commands (migrate, test) use `go run` (fast, reliable). The long-running `api` service
# hot-reloads via air: it watches apps/api/**/*.go, rebuilds, and restarts the process, sending
# SIGINT first (apps/api/.air.toml's send_interrupt) so internal/server's graceful shutdown path
# runs on every reload — not just on container stop. `go run` itself never forwards SIGTERM to its
# spawned child, which is why air (not a bare `go run` loop) owns the process directly.
# Scaling to multiple replicas uses docker/api.Dockerfile's prebuilt static binary instead — this
# image is dev-only, never used to build what actually ships.
FROM golang:1.27-alpine

RUN apk add --no-cache git
RUN go install github.com/air-verse/air@v1.67.4

WORKDIR /w/apps/api
