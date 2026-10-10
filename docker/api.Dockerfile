# Production image: the API and the migration command from the same release.
FROM golang:1.27-alpine@sha256:85dc1069ac644ea3c527b177303a406eb3358192816cd7f9e5848eb658851673 AS build
WORKDIR /w/apps/api
# Dependencies first, so source changes reuse the downloaded-module layer.
COPY apps/api/go.mod apps/api/go.sum ./
RUN go mod download
COPY apps/api/ ./
RUN CGO_ENABLED=0 go build -trimpath -buildvcs=false -o /out/api ./cmd/api
RUN CGO_ENABLED=0 go build -trimpath -buildvcs=false -o /out/migrate ./cmd/migrate

FROM alpine:3.24@sha256:294b683cb724975bec92580e1e685676bd4b50bda910ddb8c51d4cabeaec77e6
# Alpine's security fixes before the base image is republished (C180), then wget,
# which serves container health checks against /api/healthz.
RUN apk upgrade --no-cache && apk add --no-cache ca-certificates wget
COPY --from=build /out/api /usr/local/bin/api
COPY --from=build /out/migrate /usr/local/bin/migrate
# Run as an unprivileged user; the API needs no root access.
USER 65532:65532
ENTRYPOINT ["/usr/local/bin/api"]
