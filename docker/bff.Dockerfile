# Production image of one BFF instance (C90, C99): the BFF with its app embedded.
#   docker build -f docker/bff.Dockerfile --build-arg APP=app   -t bool-bff-app .
#   docker build -f docker/bff.Dockerfile --build-arg APP=admin -t bool-bff-admin .
# Each image contains only its own app. EDITION picks the workspace's edition
# (apps/app/editions/<name>.ts, C107); the admin app has none.
ARG APP
ARG EDITION=full

# The app's `vite build`, with the same Node and pnpm as development (node.Dockerfile).
FROM node:26-alpine AS app
ARG APP
ARG EDITION
RUN test -n "$APP" || (echo "build with --build-arg APP=app|admin" >&2 && exit 1)
RUN npm install -g corepack@latest && corepack enable && corepack prepare pnpm@12.4.1 --activate
WORKDIR /w
# Only the workspace, never docker/secrets or other repository files.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY e2e/package.json e2e/
COPY packages/ packages/
COPY apps/ apps/
RUN pnpm install --frozen-lockfile --filter "${APP}..." && EDITION="${EDITION}" pnpm --filter "${APP}" build

# The BFF, with the build in place of the placeholder that go:embed reads.
FROM golang:1.27-alpine AS build
ARG APP
WORKDIR /w/apps/api
# Dependencies first, so source changes reuse the downloaded-module layer.
COPY apps/api/go.mod apps/api/go.sum ./
RUN go mod download
COPY apps/api/ ./
RUN rm -rf internal/bff/web/app
COPY --from=app /w/apps/${APP}/dist/ internal/bff/web/app/
RUN CGO_ENABLED=0 go build -trimpath -buildvcs=false -o /out/bff ./cmd/bff

FROM alpine:3.22
# wget serves container health checks against /healthz.
RUN apk add --no-cache ca-certificates wget
COPY --from=build /out/bff /usr/local/bin/bff
# Run as an unprivileged user; the BFF needs no root access.
USER 65532:65532
ENTRYPOINT ["/usr/local/bin/bff"]
