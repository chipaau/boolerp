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

## Selected direction (C83)

Every web login goes through Ory Hydra (OAuth2/OpenID Connect) with Ory Kratos as its
login provider: one login service (`identity.bool.test` in development) for every
domain the API serves, because open-source Kratos cannot set session cookies on
unrelated domains such as customers' own domains or `findcare.mv`. The API is a Hydra
client: it completes the login on the request's own domain and keeps its own session
there. The roadmap delivers this in steps 7a–7f; custom-domain login (7f) follows the
tenancy domain registry. Whether ERP and FindCare share accounts is still open.

Each client can have a fully custom login page design (C84): our own login UI reads
the OAuth2 client from the Kratos login flow and renders that client's design, so
FindCare's login looks like FindCare. Every design renders the fields the Kratos flow
defines, keeps its CSRF token, and posts to Kratos. The pages stay on the login
service's domain; a form on a client's own domain would need a separate Kratos and
Hydra.

## Hydra (7b, C89)

Hydra v26.2.0 runs in Compose with its own `hydra` database and role, migrated by
`hydra-migrate`. Its issuer is `http://identity.bool.test/`: Traefik sends `/oauth2/*`,
`/.well-known/openid-configuration`, `/.well-known/jwks.json`, and `/userinfo` there.
When a client starts a login, Hydra sends the browser to `/login?login_challenge=…`;
the login service passes the challenge to Kratos, which accepts Hydra's login request
after sign-in. Hydra then calls `/consent`, a route of the login service that approves
first-party clients (`skip_consent`) and refuses others with `access_denied`.

First-party clients are defined in `docker/hydra/clients/<client-id>.json` and
registered by the `hydra-clients` service (`docker compose up hydra-clients` re-runs
it); each client's secret is the Compose secret `hydra_client_<client-id>`. To try a
login as a client:

```sh
docker run --rm -p 5555:5555 --add-host identity.bool.test:host-gateway \
  -e OAUTH2_CLIENT_ID=dev-test-client \
  -e OAUTH2_CLIENT_SECRET="$(cat docker/secrets/dev/hydra_client_dev-test-client)" \
  oryd/hydra:v26.2.0 perform authorization-code --endpoint http://identity.bool.test/ \
  --port 5555 --no-open --scope openid,offline
```

then open `http://127.0.0.1:5555/` and sign in.

## Authentication model (C88)

Browsers never hold Hydra tokens. For the internal apps the Go API is a
backend-for-frontend: it is Hydra's confidential client, completes the login on the
request's own domain, keeps tokens on the server, and gives the browser an HttpOnly
session cookie. Non-browser clients (mobile, integrations, services) will send Hydra
access tokens as `Authorization: Bearer`, which the API validates. Both become the
same caller context (7d).

## Accounts and development services (7a-1, C85)

Kratos v26.2.0 runs in Compose with its own `kratos` database and `erp_kratos` role
(`docker/postgres/init/20-kratos.sh`), migrated by the `kratos-migrate` service. Its
config is `docker/kratos/kratos.yml`, merged with `docker/secrets/dev/kratos.yml`
(database address, cookie and cipher secrets, provider client secrets) mounted as a
Compose secret. Browsers reach its public API at `http://identity.bool.test/kratos`;
the admin API (`http://kratos:4434`) is only on the internal network.

- **Accounts:** a new account has one email (`traits.email`), a phone, and an optional
  name (`registration.schema.json`). Extra emails are added through the admin API as
  verified, into `traits.additional_emails`, switching the account to
  `account.schema.json`; self-service settings can change the password and link
  Google, not account fields.
- **Login:** email and password, or Google. An account logs in once it has a verified
  email; codes for verification and recovery are sent by email.
- **Development mail and SMS:** Mailpit at `http://mail.bool.test` catches all email;
  SMS is configured to arrive there too through Mailpit's send API.
- **Google in development:** `mock-oauth2-server` at `http://oidc.bool.test/default`,
  configured in Kratos as the `google` provider; its login page lets you choose any
  user and claims (for example `{"email": "a@b.test", "email_verified": true}`).

Known gap in open-source Kratos v26.2.0 (C85): SMS phone verification is not
available, so phones are unverified until a release supports it (required before
go-live).

## Login UI (7a-2, C86)

`apps/identity` serves the login pages at `http://identity.bool.test` (login,
registration, verification, recovery, settings, error). It is a Next.js app (C87):
each page's server loads its Kratos flow over the internal network
(`KRATOS_INTERNAL_URL`), passing on the browser's cookies, and Ory Elements renders
it; `theme/bool.tsx` replaces Elements' visual components with the Bool sign-in design
from `@workspace/ui`. A page without `?flow=` sends the browser to Kratos to start one;
expired or unknown flows start again. It does not use `packages/auth`. Hydra's consent
route will be part of the same app (7b).

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
