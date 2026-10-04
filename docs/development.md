# Development and repository layout

Updated: 2026-10-03.

The active checkout is `/Users/chipaau/code/bool/erp`, remote
`git@github.com:boolmv/erp.git`. Do not work from the sibling `go-erp`
checkout.

The API lives in `apps/api/` in this monorepo.

The API is built step by step (C24); the commands and settings
below work against the current code. The [roadmap](roadmap.md) has the status.

## Locations

| Location | Purpose |
| --- | --- |
| apps/api/ | The Go API, the BFF, and their commands (`cmd/api`, `cmd/bff`, `cmd/migrate`, `cmd/deploy`, `cmd/seed`) |
| apps/workspace/ | The workspace shell and its apps (C102, C108) |
| docs/ | All product and engineering documentation |
| .claude/ | Substantive agent instructions |
| AGENTS.md and CLAUDE.md | Agent navigation entry points |
| docker/ | Container definitions/configuration |
| compose.yaml | Development service configuration |

## Compose baseline

[compose.yaml](../compose.yaml) started with `api`, `app` (now `workspace`, C108), `postgres`, and `redis` (C08) and adds services when a step needs them: `lgtm` (`grafana/otel-lgtm`) for viewing traces and metrics in Grafana at `http://grafana.bool.test` (C82, replacing Jaeger from C63); `kratos` and `kratos-migrate` for accounts at `http://identity.bool.test/kratos`, `identity` for the login pages at `http://identity.bool.test` (Next.js, C86, C87), `hydra`, `hydra-migrate`, and `hydra-clients` for OAuth2 and OpenID Connect with the issuer `http://identity.bool.test/` (C89), `mailpit` for development email and SMS at `http://mail.bool.test`, and `oidc` standing in for Google at `http://oidc.bool.test` (C85; see [identity](platform/identity.md)), `redis-sessions`, `bff-workspace`, and `bff-admin` for the backends-for-frontend, which serve `/auth/*` on tenant domains and on `admin.bool.test` (C90, C96, C97), and `admin`, the admin app's dev server at `http://admin.bool.test` (C97); `cerbos`, the authorization policy engine, on the internal network only (gRPC `cerbos:3593` for the API, HTTP `cerbos:3592` for its healthcheck and debugging, C152); and the `migrate` and `seed` tools (profile `tools`).
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
demand: `docker compose run --rm migrate`, then `seed` fills the database:
`docker compose run --rm seed` (C137).
Keep Compose project name `erp` so volume names stay stable. Preserve the current `.env`; on a
new checkout only, initialize it from `.env.example`. Removed service volumes are
not deleted.

The configuration retains the shared external `proxy` network used by local
Traefik routing at `*.bool.test`; the proxy is not a fifth service in this file.
That external network/proxy must be provided separately when running this setup.

Other Compose projects on the same `proxy` network can reach the services joined to it,
including Kratos's and Hydra's admin ports, and their service names share its DNS: a
name such as `postgres` exists in other local projects too. Our services resolve their
own because Docker answers from the project's `internal` network first in practice,
which Docker does not guarantee. This is accepted for development (C112); production
keeps the admin APIs private ([deployment](platform/deployment.md)).

Validate configuration without starting services or printing resolved secrets:

```sh
docker compose config --quiet
docker compose config --services
```

The API command builds the new binary inside its development container and executes
it directly so shutdown signals reach the server. Runtime settings are described
below. The API creates its PostgreSQL pool at startup, checks the database through
`/api/readyz`, and does not run migrations automatically. Redis is connected as an
optional cache (C52) with no application data yet; the BFFs keep sessions in their own
Redis (`redis-sessions`).

Migrations run explicitly, never at API startup. In development:
`docker compose run --rm migrate` (`cmd/migrate`), then `docker compose run --rm seed`
(`cmd/seed`: the seed files, then demo data). In production, `cmd/deploy` does both
steps for a release; it is not run in development (C137). Migrations hold no data. Until the first production release, a table change edits
its original migration and development databases are recreated (C140).
Development volumes are disposable; reset them when needed.

## Runtime configuration

**Layout (C44):** settings are grouped by concern in `internal/platform/kit/config`: `app.go` (`APP_ENV`, `APP_PORT`, `APP_SHUTDOWN_TIMEOUT`), `log.go` (`APP_LOG_*`), `http.go` (`APP_HTTP_*`), and `database.go` (`APP_DB_*`), `redis.go` (`APP_REDIS_*`), `auth.go` (`APP_AUTH_*`), and `identity.go` (`APP_IDENTITY_*`); the BFF's are in `bff.go` (below). Add a setting to its group's file; a new concern gets its own file and `envPrefix`.

**Status (steps 1a–2b):** `APP_ENV`, `APP_PORT`, `APP_LOG_FORMAT`,
`APP_LOG_LEVEL`, `APP_SHUTDOWN_TIMEOUT`, the five `APP_HTTP_*` limits, `APP_HTTP_TRUSTED_PROXY_HOPS`, `APP_HTTP_ALLOWED_ORIGINS`, the six `APP_DB_*` connection settings, `APP_DB_MAX_CONNS`, `APP_DB_PING_TIMEOUT`, and the seven `APP_REDIS_*` settings are implemented in `internal/platform/kit/config` with `caarlos0/env`
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
| `APP_HTTP_REQUEST_TIMEOUT` | `25s` | Positive Go duration below the write timeout; each request's context deadline, so database, cache, and provider calls made for it stop, and the handler still answers with its problem response (C114) |
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
| `APP_AUTH_ISSUER` | none (required) | Hydra's issuer, exactly as in its tokens (Compose: `http://identity.bool.test/`, C91); keys come from `<issuer>.well-known/jwks.json` |
| `APP_AUTH_AUDIENCE` | `erp-api` | The audience access tokens must include |
| `APP_IDENTITY_HYDRA_ADMIN_URL` | none (required) | Hydra's admin API (Compose: `http://hydra:4445`), reachable only on the internal network; disabling an account ends its logins there (C101) |
| `APP_IDENTITY_KRATOS_ADMIN_URL` | none (required) | Kratos's admin API (Compose: `http://kratos:4434`), reachable only on the internal network; users are read from it on first use (C94) |

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

`cmd/bff` (one BFF instance, such as `bff-workspace`; C90, C96) reads only `BFF_*` settings,
loaded by `config.LoadBFF`. It reuses the API's groups under new prefixes: `BFF_ENV`,
`BFF_PORT`, `BFF_SHUTDOWN_TIMEOUT`, `BFF_LOG_*`, `BFF_HTTP_*`, and `BFF_REDIS_*` (the
session Redis) accept the same values as their `APP_` counterparts above. Its own
settings:

| Variable | Default | Accepted values |
| --- | --- | --- |
| `BFF_SESSION_IDLE_TIMEOUT` | `30m` | Positive Go duration up to `24h`; a session ends after this long without a request |
| `BFF_SESSION_LIFETIME` | `12h` | Greater than the idle timeout, up to `720h`; a session ends this long after login |
| `BFF_SESSION_COOKIE_SECURE` | `true` (Compose: `false`) | HTTPS-only cookie named `__Host-session`, and `https://` callbacks; off only for plain-HTTP development, where the cookie is `session` |
| `BFF_SESSION_ENCRYPTION_KEY_FILE` | none (required) | Path of the file holding the instance's AES-256 key as 64 hex digits (`openssl rand -hex 32`, C80). Replacing it signs sessions out |
| `BFF_OIDC_ISSUER` | none (required) | Hydra's issuer, exactly as in its discovery document (Compose: `http://identity.bool.test/`) |
| `BFF_OIDC_CLIENT_ID` | none (required) | The instance's Hydra client (Compose: `erp-workspace`) |
| `BFF_OIDC_CLIENT_SECRET_FILE` | none (required) | Path of the file holding the client's secret (C80) |
| `BFF_OIDC_AUDIENCE` | `erp-api` | The audience requested for access tokens, which the API requires (C91) |
| `BFF_API_URL` | none (required) | The API's address on the internal network, where `/api/*` is forwarded (Compose: `http://api:8080`, C98) |

Release images: `docker/api.Dockerfile` (the API and `migrate`) and
`docker/bff.Dockerfile`, built once per BFF instance with its app embedded (C99):

```sh
docker build -f docker/bff.Dockerfile --build-arg APP=workspace -t bool-bff-workspace .
```

`cmd/migrate` applies the migrations of the modules in the edition it is built with (C95), each with its own history table `migrations.<module>_version`. It reads only these settings (C47), never `APP_*`:

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
The API's readiness checks PostgreSQL. Stop the sibling `go-erp` API before
using this checkout so two wildcard routers do not compete. Through the existing local proxy,
at the API's own host (app domains' `/api` goes through their BFF and needs a session, C98):

```sh
curl --fail http://api.bool.test/api/healthz
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
`/api/readyz` checks PostgreSQL connectivity. `GET /api/auth/me` needs a Bearer token (C91);
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

## Seed data (C50, C118, C135, C137)

Seeders are `seed.Seeder`s and all idempotent. Production and development load **the
same seed files**; only the command differs:

| Seeders | Listed in | Production: `cmd/deploy` | Development: `cmd/seed` | Role |
| --- | --- | --- | --- | --- |
| Seed files: countries, legal forms, sectors, institution types; the operator tenant | `full.DataSeeders` | yes, after the migrations | yes, first | migration role (owns the tables) |
| The team's accounts without passwords | `full.DeploySeeders` | yes | no (the demo seeder creates them) | migration role |
| Sample tenants (C143) | `full.SampleSeeders` | never | yes, in `dev`, after the seed files | migration role, until tenancy has a create-tenant operation |
| Demo data: team accounts with the dev password, gofakeit data | `full.Seeders` | never | yes, after the seed files | runtime role, through use cases |

A development database is prepared with:

```sh
docker compose run --rm migrate
docker compose run --rm seed
```

In production, one command per release (it refuses `APP_ENV` other than `staging` or
`prod`):

```sh
APP_ENV=prod MIGRATE_DB_HOST=… APP_IDENTITY_KRATOS_ADMIN_URL=… deploy
```

`reference.countries` loads `internal/platform/reference/seeds/countries.csv`, the 249
ISO 3166-1 countries and territories from the public-domain
[datasets/country-codes](https://github.com/datasets/country-codes), with the cleaning
noted at the top of the file. It adds new rows and corrects changed ones in one
transaction, never deletes, and never touches `active_to`. `reference.legal_forms` does
the same for `legal_forms.csv` (per country, keyed by country and code), after the
countries it references, `reference.sectors` for `sectors.csv`, and `reference.institution_types` for
`institution_types.csv`, after the sectors.

`tenancy.operator` creates Bool's operator tenant (`workspace`, C142) if none exists, after
the reference lists; an existing operator is left as it is.

In development, `tenancy.sample_tenants` (C143) then adds the sample tenants in
`tenancy/seeds/sample_tenants.csv` (ministries, atoll hospitals, health centres, clinics,
councils, schools, colleges), as the table owner, until tenancy has a create-tenant operation.

`identity.team_accounts` creates the team's accounts (`identity/seeds/team.go`) in
Kratos, with a verified email and no password. For each account it creates, `deploy`
prints a one-time recovery link and code, valid for an hour, with which that person
sets their own password; it prints them only to a terminal (never the log), so in CI
or another non-interactive run the person uses "Forgot password" instead. An existing
account is left as it is, so later deploys print nothing. `deploy` therefore needs
Kratos's admin API (`APP_IDENTITY_KRATOS_ADMIN_URL`, and `APP_IDENTITY_HYDRA_ADMIN_URL`
for the identity module). `cmd/deploy` is not a Compose service: it is production's
command and never runs in development (C137).

Tests never rely on any seeded data ([testing](testing.md)).

The rest of this section is about demo data.

Seeds work like Laravel's seeders. Each module keeps **one seeder per store** in its
`seeds` folder (`internal/platform/identity/seeds/users.go`), and the edition lists them
in dependency order (`full.Seeders`), as it lists migrations: a store is seeded after
the stores it references. `cmd/seed` runs the list. Seeders implement `seed.Seeder`
(`internal/platform/kit/seed`) and create data through their module's use cases, as the
API's runtime role, so seeded data passes the same rules as real data. Each can run
repeatedly without duplicating anything. Generated data comes from
[gofakeit](https://github.com/brianvoe/gofakeit) (`env.Fake`), seeded with a fixed value
so every run generates the same data; Maldivian names, addresses, and phone formats
need our own lists. Seeders log counts, never personal data.

`cmd/seed` refuses to run unless `APP_ENV` is set explicitly to `dev`, `test`, or
`staging`, and is not in the production image:

```sh
docker compose run --rm seed
```

In `dev`, `identity.users` gives the team's accounts (the same people `deploy` creates,
creating any that are missing) the development sign-ins: `ibrahim@bool.mv`,
`shifau@bool.mv`, and `mariyam@bool.mv`, with the password
`password` (set in the seeder: a public development value, not a secret, so not a file).
They also sign in through the development Google stand-in (`oidc.bool.test`) with the
email as the username and the claims `{"email": "<email>", "email_verified": true}`.
The password is public, so these sign-ins are added only in `dev`; an account that
already exists keeps its details and gains the two sign-ins.

## Validate the runtime

The module uses the Go 1.27 development baseline, pgx/v5, and Goose. sqlc is selected
(C116) and arrives with the tenancy tables; no generated query code exists yet.
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
clients, and interrupted responses. CI runs on pull requests to `develop` (C78, C123).

## Tooling

Use Docker for Go/Node/pnpm builds and application tests. Do not require matching
language runtimes on the host. Documentation checks can run without application
services. Do not start/stop deployed services as part of document validation.

The apps sign in through their BFFs, and each BFF's release image embeds its app (C99).
Frontend integration has started; its standards are not set yet (C128). CI is described
in [testing](testing.md).

See [architecture](architecture/backend.md), [deployment](platform/deployment.md),
and [testing](testing.md).
