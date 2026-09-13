# PRODUCTION image for apps/api: compiles a static binary once, then a minimal runtime image runs
# it directly — no Go toolchain at runtime. Use this (never docker/go.Dockerfile, which is dev-only
# and hot-reloads via air) for anything meant to scale to multiple replicas: fast, consistent boot
# regardless of replica count, no per-replica recompilation, smaller image.
#
# Build from the repo root: docker build -f docker/api.Dockerfile -t goerp-api .

FROM golang:1.27-alpine AS build
RUN apk add --no-cache git
WORKDIR /w/apps/api
COPY apps/api/go.mod apps/api/go.sum ./
RUN go mod download
COPY apps/api/ ./
RUN CGO_ENABLED=0 go build -buildvcs=false -o /out/api ./cmd/api

FROM alpine:3.22
RUN apk add --no-cache ca-certificates wget
COPY --from=build /out/api /usr/local/bin/api
ENTRYPOINT ["/usr/local/bin/api"]
