# Development and repository layout

Updated: 2026-09-26.

The active checkout is `/Users/chipaau/code/bool/erp`, remote
`git@github.com:boolmv/erp.git`. Do not run the rebuild from the sibling `go-erp`
checkout. See [repository transfer](repository-transfer.md) for branch ancestry
and the preserved security-review stash.

The fresh API lives in `apps/api/` in this monorepo. The previous source is preserved
in `apps/api.bak/`; its migrations, providers, and frontend consumers are not the
rebuild baseline.

The current branch is `api-rebuild`. The first executable layer contains a simple
Go entry point, bootstrap wiring, a standard-library HTTP server, and a liveness
endpoint. The remaining proposed directories contain `.gitkeep` placeholders.
They do not implement platform features or employee behavior.

## Locations

| Location | Purpose |
| --- | --- |
| apps/api/ | New Go API and directory scaffold |
| apps/api.bak/ | Previous API preserved without changes; excluded from new-API builds |
| apps/app/ | Existing frontend; integration deferred |
| docs/ | All product and engineering documentation |
| docs/archive/ | Explicitly superseded historical material |
| .claude/ | Substantive agent instructions |
| AGENTS.md and CLAUDE.md | Agent navigation entry points |
| docker/ | Container definitions/configuration |
| compose.yaml | Development service configuration |

## Compose baseline

[compose.yaml](../compose.yaml) contains only `api`, `app`, `postgres`, and `redis`.
Existing PostgreSQL storage and Go cache volumes are retained. Redis is currently
configured without persistence for its cache role. Keep Compose project name `erp`
to retain the existing `erp_pgdata` identity. Preserve the current `.env`; on a
new checkout only, initialize it from `.env.example`. Removed service volumes are
not deleted.

The configuration retains the shared external `proxy` network used by local
Traefik routing at `*.bool.test`; the proxy is not a fifth service in this file.
That external network/proxy must be provided separately when running this setup.

Validate configuration without starting services or printing resolved secrets:

```sh
docker compose config --quiet
docker compose config --services
```

The API command builds the new binary inside its development container and executes
it directly so shutdown signals reach the server. The process currently reads only
`APP_PORT`, defaulting to 8080. PostgreSQL/Redis connection variables are reserved
for later layers; no database/cache connection or migration runs at startup.

Do not run migrations from `apps/api.bak` or reset existing volumes. The new
`cmd/migrate` and `cmd/worker` directories are placeholders, not runnable commands.
A standalone migration service is not part of this Compose baseline.

## Start the first layer

From the repository root, with Docker/OrbStack and the external proxy running:

```sh
cd /Users/chipaau/code/bool/erp
docker compose up --build api
```

For the current liveness-only layer, `docker compose up -d --build --no-deps api`
starts only the API and avoids touching database/cache services.

The full command above starts the API and its configured PostgreSQL/Redis dependencies, not the frontend.
The API does not use those dependencies yet. Stop the sibling `go-erp` API before
using this checkout so two wildcard routers do not compete. Through the existing local proxy:

```sh
curl --fail http://cyryx.bool.test/api/healthz
```

For an isolated run without the proxy, PostgreSQL, Redis, or frontend:

```sh
docker run --rm --init \
  -p 127.0.0.1:8080:8080 \
  -v "$PWD/apps/api:/src:ro" \
  -w /src golang:1.27-alpine \
  sh -c 'go build -buildvcs=false -o /tmp/bool-api ./cmd/api && exec /tmp/bool-api'
```

In another terminal:

```sh
curl --fail http://127.0.0.1:8080/api/healthz
```

The response is `200` with JSON `{"status":"ok"}`. This is process liveness,
not dependency readiness. There are no authenticated or employee endpoints yet;
unknown paths return `404`. Invalid listen addresses or occupied ports terminate
startup with an error. SIGINT/SIGTERM initiates shutdown with a ten-second deadline.

The container does not watch source changes. After editing the API, restart its
development container to rebuild:

```sh
docker compose restart api
```

## Validate the scaffold

The new module uses the Go 1.27 development baseline and standard-library packages
only. No dependency installation, `go.sum`, database, or generated code is required.
With the Go image available locally, these checks can run without container networking:

```sh
docker run --rm --network none \
  -v "$PWD/apps/api:/src:ro" \
  -w /src golang:1.27-alpine \
  sh -ec 'test -z "$(gofmt -l cmd internal)"; go vet ./...; go test ./...; go build -o /tmp/bool-api ./cmd/api'
```

Runtime verification additionally checks the liveness response, unknown-path and
method handling, startup failures, and graceful shutdown. Docker must be running
for compilation and runtime checks; configuration validation alone does not prove them.

## Tooling

Use Docker for Go/Node/pnpm builds and application tests. Do not require matching
language runtimes on the host. Documentation checks can run without application
services. Do not start/stop deployed services as part of document validation.

Frontend builds, generated clients, and embedded assets are deferred. The old
frontend and development READMEs are retained in `docs/archive/pre-api-rebuild/repository/`.
The existing frontend source is unchanged, but its login and API integration do not
work against the health-only rebuild. The legacy E2E CI job is explicitly disabled;
frontend typecheck/build jobs remain. The production API Dockerfile builds only
the scaffold and does not embed frontend assets.

See [architecture](architecture/backend.md), [deployment](platform/deployment.md),
and [testing](testing.md).
