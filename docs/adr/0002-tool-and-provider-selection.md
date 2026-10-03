# ADR 0002: Prefer established tools and record selected platform components

Date: 2026-09-28.
Status: accepted for the component selections below; detailed integration contracts remain open.

## Context

The API should use mature frameworks, libraries, and SDKs when they fit the
confirmed requirements. Reimplementing routing, authentication, authorization,
database pooling, migrations, or object-storage protocols would add code and
maintenance without a product need. At the same time, selecting a tool does not
decide every policy or operational contract around it.

## Decision

- Use chi as the Go API HTTP framework. Step 2a moved the foundation to chi
  before business routes were added. Keep domain and application code independent
  of chi.
- Use PostgreSQL as the application database. The platform foundation uses
  pgx/v5 pgxpool and Goose; sqlc remains deferred until an approved table needs
  generated queries. (sqlc was selected in C116; it arrives with the tenancy tables.)
- Use Ory Kratos for identity and authentication. Session, provisioning, account,
  tenant, and domain-login contracts remain to be agreed.
- Use Ory Hydra as the OAuth2/OpenID Connect server in front of Kratos (C83): every
  web login goes through one login service (`identity.bool.test` in development),
  and each domain the API serves is a client of it. Open-source Kratos cannot set
  session cookies on unrelated domains (customers' own domains, `findcare.mv`); Hydra
  is the open-source way to log in on them. Session lifetimes, logout propagation,
  and client registration remain to be agreed.
- Use Cerbos as the authorization policy engine. Role, resource, policy-input,
  administration, and revocation semantics remain to be agreed.
- Use the S3 API for file/object storage. Use `chipaau/minio`, the project's exact
  fork of MinIO, as the development server. Production storage provider and Go
  client SDK remain undecided.
- Prefer a maintained, fit-for-purpose ecosystem tool over an in-house substitute.
  For architectural, provider, dependency, operational, or user-visible choices,
  present a recommendation and trade-offs and ask the user before deciding. Keep
  recommendations distinct from accepted decisions in the register and docs.

## Consequences

- These component selections do not mean their integrations are implemented.
- Existing implementation status is documented separately from selected direction.
- Canonical path cleanup uses 307 Temporary Redirect and preserves the request
  method, body, and query. This is an intentional behavior change from the prior
  ServeMux redirect; see C23 and the [HTTP contract](../platform/http.md).
  (Superseded by C39: paths match exactly, with no cleaning or redirects.)
- Detailed contracts remain open in the [decision register](../decisions/README.md)
  and their component documents.
- A suitable S3 Go SDK should be used rather than hand-writing S3 protocol code;
  evaluate the official AWS SDK for Go v2 first, but get user confirmation before
  adding a specific client dependency.
- Recommend useful established patterns with their use case and trade-offs; do
  not silently elevate a pattern proposal to a project decision.

## References

- [Decision register](../decisions/README.md)
- [HTTP foundation](../platform/http.md)
- [Identity](../platform/identity.md)
- [Authorization](../platform/authorization.md)
- [Object storage](../platform/storage.md)
- [AWS SDK for Go v2 guide](https://docs.aws.amazon.com/sdk-for-go/v2/developer-guide/welcome.html)
