# Production image of one BFF instance (C90, C99): the BFF with its app embedded.
#   docker build -f docker/bff.Dockerfile --build-arg APP=workspace -t bool-bff-workspace .
#   docker build -f docker/bff.Dockerfile --build-arg APP=admin -t bool-bff-admin .
# Each image contains only its own app. EDITION picks the workspace's edition
# (apps/workspace/editions/<name>.ts, C107); the admin app has none.
ARG APP
ARG EDITION=full

# The app's `vite build`, with the same Node and pnpm as development (node.Dockerfile).
FROM node:26-alpine@sha256:0b36e8c136b94cd4fcf02188228e76c31ad5872eef3fec8cbd2eee500cfd9e80 AS app
ARG APP
ARG EDITION
RUN test -n "$APP" || (echo "build with --build-arg APP=workspace|admin" >&2 && exit 1)
RUN npm install -g corepack@0.36.0 && corepack enable && corepack prepare pnpm@12.4.1 --activate
WORKDIR /w
# Only the workspace, never docker/secrets or other repository files.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY e2e/package.json e2e/
COPY packages/ packages/
COPY apps/ apps/
RUN pnpm install --frozen-lockfile --filter "${APP}..." && EDITION="${EDITION}" pnpm --filter "${APP}" build

# The BFF, with the build in place of the placeholder that go:embed reads.
FROM golang:1.27-alpine@sha256:85dc1069ac644ea3c527b177303a406eb3358192816cd7f9e5848eb658851673 AS build
ARG APP
WORKDIR /w/apps/api
# Dependencies first, so source changes reuse the downloaded-module layer.
COPY apps/api/go.mod apps/api/go.sum ./
RUN go mod download
COPY apps/api/ ./
RUN rm -rf internal/bff/web/app
COPY --from=app /w/apps/${APP}/dist/ internal/bff/web/app/
RUN CGO_ENABLED=0 go build -trimpath -buildvcs=false -o /out/bff ./cmd/bff

FROM alpine:3.24@sha256:294b683cb724975bec92580e1e685676bd4b50bda910ddb8c51d4cabeaec77e6
# Alpine's security fixes before the base image is republished (C180), then wget,
# which serves container health checks against /healthz.
RUN apk upgrade --no-cache && apk add --no-cache ca-certificates wget
COPY --from=build /out/bff /usr/local/bin/bff
# Run as an unprivileged user; the BFF needs no root access.
USER 65532:65532
ENTRYPOINT ["/usr/local/bin/bff"]
