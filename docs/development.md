# Development and repository layout

Updated: 2026-09-27.

The active checkout is `/Users/chipaau/code/bool/erp`, remote
`git@github.com:boolmv/erp.git`. Do not run the rebuild from the sibling `go-erp`
checkout. See [repository transfer](repository-transfer.md) for branch ancestry
and the preserved security-review stash.

The fresh API lives in `apps/api/` in this monorepo. The previous source is preserved
in `apps/api.bak/`; its migrations, providers, and frontend consumers are not the
rebuild baseline.

Steps 0–2 are merged into `dev`. Step 3 adds the
[PostgreSQL foundation](platform/postgres.md): a pgxpool lifecycle, readiness,
an explicit Goose migration command, and separated database roles. No application
tables or employee behavior are implemented.

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
it directly so shutdown signals reach the server. Runtime settings are described
below. The API creates its PostgreSQL pool at startup, checks the database through
`/api/readyz`, and does not run migrations automatically. Redis remains for a later layer.

Do not run migrations from `apps/api.bak` or reset existing volumes. The new
`cmd/migrate` is an explicit migration command; `cmd/worker` remains a placeholder.
A standalone migration service is not part of this Compose baseline.

## Runtime configuration

Settings are read once from the process environment at startup. Compose loads
`.env`; the binary does not read dotenv files itself. Unset or empty settings use
the defaults below. Nonempty values must satisfy validation; whitespace is not
silently removed.

| Variable | Default | Accepted values |
| --- | --- | --- |
| `APP_ENV` | `dev` | `dev`, `test`, `staging`, `prod`; an operational log label, not an access-control or deployment-mode switch |
| `APP_PORT` | `8080` | Decimal TCP port from 1 to 65535 |
| `APP_SHUTDOWN_TIMEOUT` | `10s` | Positive Go duration, such as `10s` or `500ms` |
| `APP_LOG_FORMAT` | `json` | `json` or `text` |
| `APP_LOG_LEVEL` | `info` | `debug`, `info`, `warn`, `error` (case-insensitive) |
| `APP_HTTP_MAX_BODY_BYTES` | `1048576` | Positive integer; maximum consumed request body size in bytes |
| `APP_HTTP_READ_HEADER_TIMEOUT` | `5s` | Positive Go duration; no greater than the full read timeout |
| `APP_HTTP_READ_TIMEOUT` | `15s` | Positive Go duration; full request read, including the body |
| `APP_HTTP_WRITE_TIMEOUT` | `30s` | Positive Go duration; greater than the read timeout to leave room for a failure response |
| `APP_HTTP_IDLE_TIMEOUT` | `60s` | Positive Go duration; wait between keep-alive requests |
| `APP_DSN` | local Compose runtime-role DSN | PostgreSQL connection string for the restricted runtime role |
| `APP_DB_MAX_CONNS` | `20` | Pool maximum from 1 to 1000 |
| `APP_DB_PING_TIMEOUT` | `2s` | Positive readiness ping timeout, up to one minute |

Invalid settings stop startup before opening the listener. The JSON error goes to
stdout and identifies the variable without echoing its value. This fallback format
also applies when `APP_LOG_FORMAT` or `APP_LOG_LEVEL` is invalid. Valid settings
configure the injected `slog` logger; lifecycle messages obey its level threshold.
See [logging and redaction](platform/observability.md) for the field policy.

`POSTGRES_USER` and `POSTGRES_PASSWORD` are only for database initialization and
administration. On a newly initialized volume, Compose creates separate runtime
and migration roles. The API receives only `APP_DSN`; it never receives
`MIGRATE_DSN` or the cluster-owner password. The PostgreSQL init script does not
run again for an existing `pgdata` volume; provision and verify the restricted
roles through the database administration process without resetting that volume.
See [the role and migration instructions](platform/postgres.md).

The API builds a lazy PostgreSQL pool at startup and reports database availability
through `/api/readyz`; `/api/healthz` remains process liveness. A PostgreSQL outage
does not expose database error details or prevent the liveness endpoint from starting.
Redis connection variables remain reserved for a later layer.

## Start the API

From the repository root, with Docker/OrbStack and the external proxy running:

```sh
cd /Users/chipaau/code/bool/erp
docker compose up --build api
```

`docker compose up -d --build --no-deps api` starts only the API. Liveness remains
available without dependencies, while readiness reports PostgreSQL as unavailable.

The full command above starts the API and its configured PostgreSQL/Redis dependencies, not the frontend.
The API uses PostgreSQL readiness; Redis is not used yet. Stop the sibling `go-erp` API before
using this checkout so two wildcard routers do not compete. Through the existing local proxy:

```sh
curl --fail http://cyryx.bool.test/api/healthz
```

For an isolated run without the proxy, PostgreSQL, Redis, or frontend, process
liveness is available and readiness returns `503` until PostgreSQL is connected:

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

The response is `200` with JSON `{"status":"ok"}`. This is process liveness;
`/api/readyz` checks PostgreSQL connectivity. There are no authenticated or employee endpoints yet;
unknown paths return a JSON `404` problem, and unsupported methods return `405`
with `Allow`. Responses reaching the handler include a generated `X-Request-ID`.
See the [HTTP contract](platform/http.md) for input/error and browser policies.
Invalid listen addresses or occupied ports terminate
startup with an error. SIGINT/SIGTERM initiates shutdown with the configured
deadline (ten seconds by default), allowing active requests to finish. Connections
still active at the deadline are closed and the process exits with an error. A
second SIGINT/SIGTERM forces termination during shutdown. Startup/shutdown and
failure logs use the configured structured logger.

The container does not watch source changes. After editing the API, restart its
development container to rebuild:

```sh
docker compose restart api
```

## Validate the runtime

The module uses the Go 1.27 development baseline, pgx/v5, and Goose. No generated
query code is included; sqlc remains deferred until an approved table needs queries.
With the Go image available locally, these checks can run without container networking:

```sh
docker run --rm --network none \
  -v "$PWD/apps/api:/src:ro" \
  -w /src golang:1.27-alpine \
  sh -ec 'test -z "$(gofmt -l cmd internal)"; go vet ./...; go test ./...; go build -o /tmp/bool-api ./cmd/api'
```

The test suite checks configuration defaults/validation, safe error messages,
log filtering/redaction, active-request draining and deadline enforcement, plus
subprocess startup, liveness, port conflicts, graceful SIGTERM shutdown, and forced
termination by a second signal. The subprocess tests run the actual entry-point function with
isolated environment settings and without PostgreSQL or Redis. Docker must be
running for compilation and runtime checks; configuration validation alone does
not prove them.

Step 2 adds HTTP contract tests and real TCP checks for request limits, slow
clients, and interrupted responses. CI runs on pull requests and pushes to `dev`.

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
