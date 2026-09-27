# Identity and authentication

Status: required backbone capability; Ory Kratos is selected for identity and
authentication. Session, domain, provisioning, and data-model contracts remain open.

## Design scope

Distinguish an authenticated user, that user's tenant membership, and an employee
business record. The proposed model allows an employee without a login and a user
without an employee record. Exact identity scope, linkage, uniqueness, and lifecycle
must be confirmed before tables are designed.

Authentication covers login, session validation/revocation, account status,
recovery, and initial account provisioning. Authentication does not by itself
authorize employee operations.

## Open decisions

- Identity/session authority and required authentication methods.
- Whether identities span tenants within an installation, and how membership is represented.
- Account provisioning, verification, recovery, and secure first-run setup.
- Session expiry, revocation guarantees, and tenant-specific access removal.
- Browser CSRF protection, login callbacks, and any future integration credentials.
- Default-domain and unrelated custom-domain login, including self-hosted operation.

Authentication must be evaluated together with [tenancy and domains](tenancy.md).
A shared parent-domain cookie does not solve login on unrelated customer domains.

## Architecture

Application ports separate use cases from the selected identity provider or session
implementation. Removing previous identity services from Compose neither selects
an alternative nor authorizes implementing credential handling without a design.

No provider ID is assumed to be the application's user primary key. No credentials,
tokens, or full identity payloads belong in traces, cache keys, or ordinary logs.
