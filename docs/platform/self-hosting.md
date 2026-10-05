# Self-hosting and licensing

Status: requirements confirmed (C09); first-run setup and licensing (D10) open;
implementation not started.

What differs when a customer runs Bool on their own servers. Everything both modes
share (one release, settings, services, proxies, migrations) is in
[deployment](deployment.md); this page is only what self-hosting adds or changes.

## Requirements

- The same codebase and release as SaaS (C09): no customer-specific builds or forks.
  Behavior differs only by settings and licence entitlements.
- A self-hosted installation normally serves one licensed customer. How many tenants and
  what hierarchy a licence allows is still open.
- Licensing discourages unauthorized resale; customer-controlled binaries are not
  tamper-proof.
- Authentication, operational dependencies, and telemetry export are configured
  deliberately, never left to rely on Bool's SaaS infrastructure.

## The operator tenant and first administrator

On a self-hosted installation the operator tenant (C115) is the customer's own
administrators' tenant, not Bool. Its people manage the installation's tenants through
the admin console, as Bool's staff do on SaaS.

**`cmd/deploy` is SaaS-only for now.** It loads the seed files and creates **Bool's**
operator tenant (`tenancyseeds.Bool`: name, code `BOOL`, contact, Maldivian legal form)
and **Bool's team accounts** (`identity/seeds/team.go`). That is right for Bool's SaaS
and wrong on a customer's server, where Bool's staff must not get accounts. Do not run
`cmd/deploy` for a self-hosted installation until first-run setup (roadmap step 13)
takes the operator tenant and its first administrator from the installer, with Bool's
details as the SaaS values.

## What the customer provides

Settings the installer must choose, with nothing defaulting to Bool's:

- **Platform domain** (`APP_PLATFORM_DOMAIN`, C159), such as `erp.example.org`: every
  tenant's workspace is `<slug>.<platform domain>` (the operator's
  `workspace.erp.example.org`). A self-hosted customer usually needs no custom domains
  (C158): their own domain is the platform domain.
- **Login domain** (the Hydra issuer) and the admin console's domain.
- **TLS certificates** for those domains, at their edge proxy.
- **PostgreSQL, Redis, and S3-compatible object storage** ([storage](storage.md)); the
  required versions are open.
- **An email server** for verification, recovery, and invitations.
- **Telemetry export**, if any ([observability](observability.md)): optional external
  trace export is open (D07).

Already independent of the deployment: every service address and the issuer are
settings, and the problem type URIs name the product on purpose (C72).

## Still open for self-hosting

- First-run setup: the operator tenant, its first administrator, and the Hydra clients'
  production bootstrap (development registers them from `docker/hydra/clients/`).
- Licensing (D10): what a licence allows (the tenant model and per-tenant subscriptions
  are decided, C115, C116); its format (signed claims verified by the backend are a
  candidate, with the signing key never in a release); activation, renewal, grace,
  expiry, and continued access to data.
- Disconnected (offline) operation.
- Installation, upgrades across releases (self-hosted installs run different releases,
  C09), backup, and restore from the customer's side.
- Installation instructions for customers, written once the above is decided.

See [deployment](deployment.md), [tenancy](tenancy.md), and [identity](identity.md).
