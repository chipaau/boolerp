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
The API currently has only an initial HTTP scaffold. Frontend integration and a
production release have not been implemented.

## Proposed direction

Use configuration and entitlements to select deployment behavior instead of
customer-specific forks. Signed license claims verified by the backend are a
candidate, not a selected license format or algorithm. Private signing material
would remain outside distributed releases.

Self-hosted authentication, operational dependencies, and telemetry export must be
deliberately configured rather than rely on implicit SaaS infrastructure.
Frontend embedding and distribution are deferred until frontend integration.

## Open decisions

- Tenant/customer/license relationship and enforceable entitlements.
- Disconnected operation, activation, renewal, grace, expiry, and continued data access.
- Required services and dependency versions.
- Secure first-run setup, configuration, migrations, upgrades, backup, and restore.
- Domain verification, certificate provisioning/renewal, and installation instructions.
- Background-worker packaging and optional operational backends.

See [development](../development.md), [tenancy](tenancy.md), and [identity](identity.md).
