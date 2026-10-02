# Production image: the API and the migration command from the same release.
FROM golang:1.27-alpine@sha256:8a5910f31396cd4d89662f56c68b3ae31d374308270a1c3bd96672ee5ed43414 AS build
WORKDIR /w/apps/api
# Dependencies first, so source changes reuse the downloaded-module layer.
COPY apps/api/go.mod apps/api/go.sum ./
RUN go mod download
COPY apps/api/ ./
RUN CGO_ENABLED=0 go build -trimpath -buildvcs=false -o /out/api ./cmd/api
RUN CGO_ENABLED=0 go build -trimpath -buildvcs=false -o /out/migrate ./cmd/migrate

FROM alpine:3.22@sha256:5291449c3df73caf6ed85e649dec1b9e818b39a5d8c871e97afc13e9cd5e8fa8
# wget serves container health checks against /api/healthz.
RUN apk add --no-cache ca-certificates wget
COPY --from=build /out/api /usr/local/bin/api
COPY --from=build /out/migrate /usr/local/bin/migrate
# Run as an unprivileged user; the API needs no root access.
USER 65532:65532
ENTRYPOINT ["/usr/local/bin/api"]
