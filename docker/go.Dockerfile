# Go dev image. Backend runs entirely in Docker (host Go not required).
# Debian-based rather than Alpine: it ships gcc, so cgo and `go test -race` work,
# and git and wget (used by the Compose health check) are already installed.
FROM golang:1.27@sha256:5bc7f572bbaa98885a3a1fd9c0aa76b59e3e14e8628bfc316bbfd0c701e4818c

COPY apps/api/go.mod apps/api/go.sum /tmp/api-module/
RUN cd /tmp/api-module && go mod download

WORKDIR /w/apps/api
