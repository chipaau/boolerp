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
