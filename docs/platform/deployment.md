# Deployment and licensing

Status: dual deployment and licensing requirements confirmed; implementation open.

## Requirements

- SaaS and customer self-hosting use the same backend codebase and release.
- Distribute the Go backend as binaries or containers.
- A self-hosted installation normally serves one licensed customer.
  Its allowed tenant count/hierarchy is still open.
- Support default customer domains and verified custom domains.
- Licensing discourages unauthorized resale; customer-controlled binaries are not tamper-proof.

The current development Compose service set is exactly api, app, postgres, and redis.
The API includes runtime configuration, structured logging, an HTTP foundation,
and PostgreSQL pool/readiness/migration tooling. Frontend integration and a
production release have not been implemented.

## Proposed direction

Use configuration and entitlements to select deployment behavior instead of
customer-specific forks. Signed license claims verified by the backend are a
candidate, not a selected license format or algorithm. Private signing material
would remain outside distributed releases.

Self-hosted authentication, operational dependencies, and telemetry export must be
deliberately configured rather than rely on implicit SaaS infrastructure.
Frontend embedding and distribution are deferred until frontend integration.
File/object storage uses the S3 API; development uses `chipaau/minio`, while the
production provider and SDK remain open. See [storage](storage.md).

## Open decisions

- Tenant/customer/license relationship and enforceable entitlements.
- Disconnected operation, activation, renewal, grace, expiry, and continued data access.
- Required services and dependency versions.
- Secure first-run setup, configuration, migrations, upgrades, backup, and restore.
- Domain verification, certificate provisioning/renewal, and installation instructions.
- Background-worker packaging and optional operational backends.

See [development](../development.md), [tenancy](tenancy.md), and [identity](identity.md).

## Reverse proxy requirements (C40)

- Set `APP_HTTP_TRUSTED_PROXY_HOPS` to the number of proxies in front of the API that
  append to `X-Forwarded-For` (for example 1 for a single load balancer, 2 for CDN →
  load balancer). Too low lets clients spoof their IP; too high records no client IP.
- Verify once after deploying: send a request from a known IP and check the request
  log's `client.address`.
- Make the API reachable only through the proxy (no published port, firewall or
  network policy), because anyone connecting directly can write their own
  `X-Forwarded-For`.

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

Limits that need to know the user, such as login attempts, cannot be enforced by the
proxy; they are decided with identity (step 7).

## Database migrations (C46, C47)

- The release image contains `/usr/local/bin/migrate`. Run it, with the migration
  role's `MIGRATE_DB_*` settings, before starting the new API version; the API never
  migrates at startup and never receives those settings.
- Connect it directly to PostgreSQL, not through a transaction pooler such as
  PgBouncer.
- Migrations are forward-only. Recover from a bad release by fixing forward or
  restoring a backup (D10), not by running migrations down.
- Concurrent runs are safe: an advisory lock lets one apply while others wait.
