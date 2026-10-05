# Deployment

Status: dual deployment requirements confirmed (C09); implementation open.

How the backend is released and run, for both Bool's SaaS and customers' own servers.
What only self-hosting adds (first-run setup, what the customer provides, licensing) is
in [self-hosting](self-hosting.md).

## Requirements

- SaaS and customer self-hosting use the same backend codebase and release (C09).
- Distribute the Go backend as binaries or containers.
- Support default customer domains and verified custom domains (C158).
- Use configuration and entitlements to select deployment behavior instead of
  customer-specific forks.

Development runs the full stack in Compose (see [development](../development.md)): the
API, the BFFs with their apps, Kratos, Hydra, the login service, PostgreSQL, and Redis.
Each BFF's release image embeds its app (C99); the public apps' distribution is not
decided. File/object storage uses the S3 API; development uses `chipaau/minio`, while
the production provider and SDK remain open. See [storage](storage.md). No production
release or deployment exists yet.

`cmd/deploy` (C135, C137) seeds Bool's operator tenant and team accounts, so it is for
Bool's SaaS only until first-run setup exists ([self-hosting](self-hosting.md)).

## Open decisions

- Required services and dependency versions.
- Secure first-run setup, configuration, migrations, upgrades, backup, and restore.
- The Hydra clients' production bootstrap; custom-domain callbacks, verification, and
  certificate provisioning and renewal (step 7f).
- Background-worker packaging and optional operational backends.

Licensing and the rest of self-hosting are in [self-hosting](self-hosting.md). See
[development](../development.md), [tenancy](tenancy.md), and [identity](identity.md).

## Reverse proxy requirements (C40)

- Set `APP_HTTP_TRUSTED_PROXY_HOPS` to the number of proxies in front of the API that
  append to `X-Forwarded-For` (for example 1 for a single load balancer, 2 for CDN →
  load balancer). Too low lets clients spoof their IP; too high records no client IP.
- Verify once after deploying: send a request from a known IP and check the request
  log's `client.address`.
- Make the API reachable only through the proxy (no published port, firewall or
  network policy), because anyone connecting directly can write their own
  `X-Forwarded-For`.
- Keep Kratos's and Hydra's admin APIs (ports 4434 and 4445, which have no
  authentication) on a private network that the edge proxy and anything else outside
  the deployment cannot reach (C112). The development Compose file does not: Kratos and
  Hydra join the shared `proxy` network so Traefik can route their public APIs, which
  leaves their admin ports reachable from other projects' containers on that network.

## Rate limiting (C81)

The API does not limit request rates; the proxy in front of it must. Every deployment,
SaaS or self-hosted, needs a per-client-IP limit at its edge proxy or CDN. Without one
there is no limit at all.

- Count the real client IP, not a CDN's or load balancer's address. In Traefik, set
  `ratelimit.sourcecriterion.ipstrategy.depth` to the number of proxies in front of it
  (like `APP_HTTP_TRUSTED_PROXY_HOPS`); when Traefik is the edge, the default (the
  connecting address) is right.
- Keep the limit generous: an office usually reaches the API from one public IP, and
  the frontend makes several calls per screen. The development Compose file uses
  1000 requests a minute per IP with bursts of 100 (Traefik's `average`, `period`,
  `burst`; a `burst` of 1 would reject parallel requests). Copy its labels as a
  starting point.
- With several proxy instances, each counts separately unless the proxy shares its
  counters (Traefik's `ratelimit.redis` option, or a CDN's rate limiting).
- Rejected requests get the proxy's `429`: Traefik sends `Retry-After` and a plain-text
  body, not the API's problem details (see [HTTP](http.md)).

The login domain has its own, tighter limits per address (C112): 10 Kratos form
submissions a minute (sign-in, registration, recovery, verification), 20 requests a
second for the login pages, and 100 for Hydra; see [identity](identity.md). Limits
that need to know the account, such as attempts per account across addresses, are
not enforced yet.

## Database migrations (C46, C47)

- The release image contains `/usr/local/bin/migrate`. Run it, with the migration
  role's `MIGRATE_DB_*` settings, before starting the new API version; the API never
  migrates at startup and never receives those settings.
- Connect it directly to PostgreSQL, not through a transaction pooler such as
  PgBouncer.
- Migrations are forward-only. Recover from a bad release by fixing forward or
  restoring a backup (D10), not by running migrations down.
- Concurrent runs are safe: an advisory lock lets one apply while others wait.
