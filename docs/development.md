# Development and repository layout

Updated: 2026-09-27.

The active checkout is `/Users/chipaau/code/bool/erp`, remote
`git@github.com:boolmv/erp.git`. Do not run the rebuild from the sibling `go-erp`
checkout.

The fresh API lives in `apps/api/` in this monorepo. The previous source is preserved
in `apps/api.bak/`; its migrations, providers, and frontend consumers are not the
rebuild baseline.

**Reset (C24, 2026-09-28):** the implementation of steps 0–3 was removed to rebuild
the API from scratch. The commands, settings, and layout below describe the rebuild
target and will not work until the corresponding roadmap step is rebuilt.

## Locations

| Location | Purpose |
| --- | --- |
| apps/api/ | New Go API and directory scaffold |
| apps/api.bak/ | Previous API preserved without changes; excluded from new-API builds |
| apps/app/ | Existing frontend; integration deferred |
| docs/ | All product and engineering documentation |
| .claude/ | Substantive agent instructions |
| AGENTS.md and CLAUDE.md | Agent navigation entry points |
| docker/ | Container definitions/configuration |
| compose.yaml | Development service configuration |

## Compose baseline

[compose.yaml](../compose.yaml) started with `api`, `app`, `postgres`, and `redis` (C08) and adds services when a step needs them: `lgtm` (`grafana/otel-lgtm`) for viewing traces and metrics in Grafana at `http://grafana.bool.test` (C82, replacing Jaeger from C63); `kratos` and `kratos-migrate` for accounts at `http://identity.bool.test/kratos`, `identity` for the login pages at `http://identity.bool.test` (C86), `mailpit` for development email and SMS at `http://mail.bool.test`, and `oidc` standing in for Google at `http://oidc.bool.test` (C85; see [identity](platform/identity.md)).
PostgreSQL stores data in the `erp_pgdata` volume (C49). When it is empty, first
start creates the `erp` database and `10-roles.sh` creates the runtime and migration
roles, then applies `database-setup.psql` (grants and the `migrations` schema, C79), as
Laravel Sail does. Compose mounts the whole `docker/postgres/init` directory; the
entrypoint runs only `*.sh` and `*.sql` files there, so the `.psql` file runs once,
through the script. Tables come from
`cmd/migrate`. To start over locally, remove the volume deliberately
(`docker compose down` then `docker volume rm erp_pgdata`); nothing removes it
automatically. Go cache volumes are retained. Redis is currently configured without persistence for its cache role.
Passwords reach containers as files, not environment variables (C80): Compose
`secrets` mount `postgres_password`, `db_app_password`, and `db_migrate_password` from
`docker/secrets/dev` (committed throwaway local passwords, the same values the
examples always used) under `/run/secrets`, the way Docker and Kubernetes secrets are
mounted in production, so development exercises the same `_FILE` settings; there is
no password in `.env` or any variable. Each container gets only the passwords it
needs. The `migrate` service (profile `tools`) runs migrations on
demand: `docker compose run --rm migrate`.
Keep Compose project name `erp` so volume names stay stable. Preserve the current `.env`; on a
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

**Layout (C44):** settings are grouped by concern in `internal/platform/config`: `app.go` (`APP_ENV`, `APP_PORT`, `APP_SHUTDOWN_TIMEOUT`), `log.go` (`APP_LOG_*`), `http.go` (`APP_HTTP_*`), and `database.go` (`APP_DB_*`), and `redis.go` (`APP_REDIS_*`). Add a setting to its group's file; a new concern gets its own file and `envPrefix`.

**Rebuild status (steps 1a–2b):** `APP_ENV`, `APP_PORT`, `APP_LOG_FORMAT`,
`APP_LOG_LEVEL`, `APP_SHUTDOWN_TIMEOUT`, the five `APP_HTTP_*` limits, `APP_HTTP_TRUSTED_PROXY_HOPS`, `APP_HTTP_ALLOWED_ORIGINS`, the six `APP_DB_*` connection settings, `APP_DB_MAX_CONNS`, `APP_DB_PING_TIMEOUT`, and the seven `APP_REDIS_*` settings are implemented in `internal/platform/config` with `caarlos0/env`
(C26) and `go-playground/validator` (C27). Each remaining variable below is added
with the step that uses it. `APP_LOG_LEVEL` is parsed by `slog.Level` itself, so it
also accepts slog offsets such as `info+2`.

**Documented gap:** `caarlos0/env` parse errors (`env.ParseError`) embed the
rejected value and name the Go field. `config.Load` replaces them with the variable
name and expected type, such as `APP_PORT: invalid int`. Validation errors use the
`env` tag as the field name and never include `FieldError.Value()`. Parsing stops
before validation, so a parse error hides validation errors for other variables.

Settings are read once from the process environment at startup. Compose loads
`.env`; the binary does not read dotenv files itself. Unset or empty settings use
the defaults below. Nonempty values must satisfy validation; whitespace is not
silently removed.

| Variable | Default | Accepted values |
| --- | --- | --- |
| `APP_ENV` | `dev` | `dev`, `test`, `staging`, `prod`; an operational log label and the seed guard (C50): seeding requires it set explicitly to a non-production value. It is not an access-control switch |
| `APP_PORT` | `8080` | Decimal TCP port from 1 to 65535 |
| `APP_SHUTDOWN_TIMEOUT` | `35s` | Positive Go duration up to `10m`; at least `APP_HTTP_WRITE_TIMEOUT` so any allowed request can finish (C30) |
| `APP_LOG_FORMAT` | `json` | `json` or `text` |
| `APP_LOG_LEVEL` | `info` | `debug`, `info`, `warn`, `error` (case-insensitive) |
| `APP_HTTP_MAX_BODY_BYTES` | `1048576` | Integer from 1 to 104857600 (100 MiB); maximum consumed request body size in bytes |
| `APP_HTTP_READ_HEADER_TIMEOUT` | `5s` | Positive Go duration up to `1m`; no greater than the full read timeout |
| `APP_HTTP_READ_TIMEOUT` | `15s` | Positive Go duration up to `5m`; full request read, including the body |
| `APP_HTTP_WRITE_TIMEOUT` | `30s` | Positive Go duration up to `10m`; greater than the read timeout to leave room for a failure response |
| `APP_HTTP_IDLE_TIMEOUT` | `60s` | Positive Go duration up to `10m`; wait between keep-alive requests |
| `APP_HTTP_TRUSTED_PROXY_HOPS` | `0` (Compose: `1`) | Integer 0–10; reverse proxies appending to `X-Forwarded-For` (C40). `0` ignores forwarded headers |
| `APP_HTTP_ALLOWED_ORIGINS` | empty | Comma-separated origins (`https://app.example`), no wildcards, allowed cross-origin (C41). Empty allows none |
| `APP_DB_HOST` | none (required) | PostgreSQL host name or IP (C43) |
| `APP_DB_PORT` | `5432` | TCP port from 1 to 65535 |
| `APP_DB_NAME` | none (required) | Database name |
| `APP_DB_USER` | none (required) | The restricted runtime role |
| `APP_DB_PASSWORD_FILE` | none (required) | Path of the file holding the runtime role's password (C80), such as a Docker or Kubernetes secret. A secret: never logged or echoed in errors; no URL escaping needed |
| `APP_DB_SSLMODE` | `verify-full` (Compose: `disable`) | `disable`, `require`, `verify-ca`, or `verify-full`; `allow`/`prefer` are rejected |
| `APP_DB_MAX_CONNS` | `20` | Pool maximum from 1 to 1000 |
| `APP_DB_PING_TIMEOUT` | `2s` | Positive readiness ping timeout, up to one minute (C45) |
| `APP_REDIS_HOST` | none (required) | Redis host name or IP (C53) |
| `APP_REDIS_PORT` | `6379` | TCP port from 1 to 65535 |
| `APP_REDIS_USERNAME` | empty | Redis ACL user; optional, but production should use authentication |
| `APP_REDIS_PASSWORD_FILE` | empty | Path of the file holding the Redis password (C80); optional locally, set in production |
| `APP_REDIS_DB` | `0` | Redis database number, 0–15 |
| `APP_REDIS_TLS` | `true` (Compose: `false`) | Encrypt and verify the server certificate |
| `APP_REDIS_TIMEOUT` | `500ms` | Bound on each connect, read, and write, up to `10s`; an unavailable cache fails fast (C52) |

Passwords are read only from files (C80), as Docker and Kubernetes mount secrets
(`/run/secrets/...`): the `_FILE` variable names the file, and its contents are the
password exactly, so write it without a trailing newline (`printf '%s' "$pw" > file`,
not `echo`). A missing or empty file stops startup; the error names the variable and
path but never the contents. Secrets in files stay out of `docker inspect` and
process environment listings.

Invalid settings stop startup before opening the listener. The JSON error goes to
stdout and identifies the variable without echoing its value. This fallback format
also applies when `APP_LOG_FORMAT` or `APP_LOG_LEVEL` is invalid. Valid settings
configure the injected `slog` logger; lifecycle messages obey its level threshold.
See [logging and redaction](platform/observability.md) for the field policy.

`cmd/migrate` reads only these settings (C47), never `APP_*`:

| Variable | Default | Accepted values |
| --- | --- | --- |
| `MIGRATE_DB_HOST` | none (required) | PostgreSQL host name or IP; connect directly, not through a transaction pooler |
| `MIGRATE_DB_PORT` | `5432` | TCP port from 1 to 65535 |
| `MIGRATE_DB_NAME` | none (required) | Database name |
| `MIGRATE_DB_USER` | none (required) | The migration role |
| `MIGRATE_DB_PASSWORD_FILE` | none (required) | Path of the file holding the migration role's password (C80) |
| `MIGRATE_DB_SSLMODE` | `verify-full` | `disable`, `require`, `verify-ca`, or `verify-full` |

`POSTGRES_USER` and the owner password (`postgres_password`) are only for database initialization and
administration. On a newly initialized volume, Compose creates separate runtime
and migration roles. The API receives only the runtime role's `APP_DB_*` settings; it never receives
the migration role's `MIGRATE_DB_*` settings or the cluster-owner password. The PostgreSQL init script does not
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
  -w /src golang:1.27 \
  sh -c 'go build -buildvcs=false -o /tmp/bool-api ./cmd/api && exec /tmp/bool-api'
```

In another terminal:

```sh
curl --fail http://127.0.0.1:8080/api/healthz
```

The response is `200` with JSON `{"status":"ok"}` (C36). This is process liveness;
`/api/readyz` checks PostgreSQL connectivity. There are no authenticated or employee endpoints yet;
unknown paths return a JSON `404` problem, and unsupported methods return `405`
with `Allow`. Responses after the liveness check include a server-generated `X-Request-Id` (UUIDv7).
See the [HTTP contract](platform/http.md) for input/error and browser policies.
Invalid listen addresses or occupied ports terminate
startup with an error. SIGINT/SIGTERM initiates shutdown with the configured
deadline (35 seconds by default), allowing active requests to finish. Connections
still active at the deadline are closed and the process exits with an error. A
second SIGINT/SIGTERM forces termination during shutdown: after the first signal
the handler is removed (`signal.NotifyContext` plus `context.AfterFunc`), so the
second uses Go's default action and the process exits with status 128 + signal
(143 for SIGTERM). A clean shutdown exits 0. Startup/shutdown and failure logs use
the configured structured logger. Compose sets `stop_grace_period: 40s` so Docker's
SIGKILL comes after the default 35-second shutdown deadline.

To rebuild automatically on changes, start the API with Compose watch. It restarts
the container when a `.go` file, `go.mod`, or `go.sum` under `apps/api` changes; the
restart goes through the normal graceful shutdown and the command rebuilds:

```sh
docker compose up --watch --no-deps api
```

Without `--watch`, the container does not watch source changes. Restart it to rebuild:

```sh
docker compose restart api
```

## Validate the runtime

The module uses the Go 1.27 development baseline, pgx/v5, and Goose. No generated
query code is included; sqlc remains deferred until an approved table needs queries.
The same checks CI runs, using the Debian-based Go image (the race detector needs cgo):

```sh
docker run --rm \
  -v "$PWD/apps/api:/src:ro" \
  -w /src golang:1.27 \
  sh -ec 'test -z "$(gofmt -l .)"; go vet ./...; go test -race ./...; go build -o /tmp/bool-api ./cmd/api'
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

Frontend builds, generated clients, and embedded assets are deferred.
The existing frontend source is unchanged, but its login and API integration do not
work against the health-only rebuild. The legacy E2E CI job is explicitly disabled;
frontend typecheck/build jobs remain. The production API Dockerfile builds only
the scaffold and does not embed frontend assets.

See [architecture](architecture/backend.md), [deployment](platform/deployment.md),
and [testing](testing.md).
