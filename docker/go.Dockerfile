# Go dev image. Backend runs entirely in Docker (host Go not required).
# Debian-based rather than Alpine: it ships gcc, so cgo and `go test -race` work,
# and git and wget (used by the Compose health check) are already installed.
FROM golang:1.27@sha256:e0174e51e81218523251d85d248a90d24c3d5e81543b4f07a5d66229397db190

COPY apps/api/go.mod apps/api/go.sum /tmp/api-module/
RUN cd /tmp/api-module && go mod download

WORKDIR /w/apps/api
