# Identity and authentication

Status: implemented for the default domains: Kratos accounts, Hydra login, the BFFs'
sessions and logout, users, and disabled accounts (C83-C101, C112, C114, C126). Open:
login on verified custom domains (step 7f), identity scope per tenant, and self-hosted
identity setup (D04).

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
unrelated domains such as customers' own domains or `findcare.mv`. Each app's BFF is a
Hydra client: it completes the login on the request's own domain and keeps its own
session there (C88, C90); the API only accepts Bearer tokens (C91). The roadmap delivers this in steps 7a–7g; custom-domain login (7f) follows the
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

**Claims (C157).** On approving, `/consent` reads the account from Kratos's admin API
(`KRATOS_ADMIN_URL`, internal network, the consent route only) by the consent request's
subject and puts the OpenID Connect standard claims for the granted scopes into Hydra's
ID-token session: `email` gives `email` and `email_verified` (from Kratos's verified
addresses), `phone` gives `phone_number` (no `phone_number_verified`: Kratos does not
verify phones, C85), and `profile` gives `name` and `picture`, each only when the account
has it. Hydra returns them in the ID token and from `/userinfo`; the access token never
carries them, so the API learns a person's details only by asking `/userinfo`. The
first-party clients and the BFFs request `openid offline_access email phone profile`, and
Hydra's discovery advertises those scopes and claims.

First-party clients are defined in `docker/hydra/clients/<client-id>.json` and
registered by the `hydra-clients` service (`docker compose up hydra-clients` re-runs
it); each client's secret is the Compose secret `hydra_client_<client-id>`. Hydra
requires PKCE on every authorization code flow (C111), which `hydra perform
authorization-code` does not send, so `dev-test-client` no longer completes a login
with it; sign in through an app (`http://male-city.bool.test/`) or with an OAuth2 client
that sends PKCE.

## Authentication model (C88, C90, ADR 0003)

Browsers never hold Hydra tokens. Each internal app has a backend-for-frontend (BFF)
service (`bff-workspace`, `bff-admin`; `apps/api/cmd/bff`): it embeds and serves the app,
completes the login with Hydra on the request's own domain, keeps the session in its
own Redis (`redis-sessions`), gives the browser an HttpOnly session cookie, and forwards `/api/*` to the
API with the session's access token as `Authorization: Bearer`. The API accepts only
Bearer tokens, from the BFF and from non-browser clients (mobile, integrations,
services), and keeps no sessions. Every request becomes the same caller context (7d).

## BFF login and sessions (7c-2, C96)

`bff-workspace` (`apps/api/cmd/bff`, Hydra client `erp-workspace`) serves its login on tenant
domains at `/auth/*`; `/api/*` belongs to the API. `GET /auth/login?return_to=/path`
sends the browser to Hydra (PKCE, state, nonce, scopes `openid offline_access email phone
profile`, audience `erp-api`); Hydra returns it to `https://<domain>/auth/callback`, where
the BFF exchanges the code, verifies the ID token, registers the person with the API
(`POST /api/auth/me` with the new access token, C157; if that fails, the refresh token
is revoked, no session is made, and the browser gets 502), starts a new session, and
redirects to the
local `return_to` path: a path on the same site, parsed by `url.Parse` (which refuses
control characters, which browsers would strip, turning `/\t/evil` into `//evil`), with
no scheme, host, `//` prefix, or backslash; anything else returns to `/` (C112). The callback must be registered on the client
(`docker/hydra/clients/erp-workspace.json`); development registers `male-city.bool.test`
(the e2e suite's workspace) and `cyryx.bool.test`, sample tenants' platform hosts (C158).
Every workspace host needs its callback here until step 7f drives the list from `domains`.

- **Session:** in `redis-sessions` (no eviction, AOF), keyed by the SHA-256 hash of the
  cookie's token; ends 30 minutes after the last request or 12 hours after login.
  Kratos's own session lasts 12 hours, so a BFF session that ends sooner signs back in
  without the password form, and a password is asked for at least every 12 hours.
- **Cookie:** `__Host-session` (Secure) over HTTPS, `session` in plain-HTTP
  development; HttpOnly, `SameSite=Lax`, `Path=/`, host-only, ending with the browser.
- **Tokens:** Hydra's access, refresh, and ID tokens are sealed with AES-256-GCM under
  the instance's key (`BFF_SESSION_ENCRYPTION_KEY_FILE`) and bound to the session's
  account. Replacing the key signs everyone out of the BFF, which costs a silent
  re-login.

`bff-admin` (client `erp-admin`, C97) does the same at `admin.bool.test`, with its own
session key. Both BFFs share `redis-sessions` under separate key prefixes
(`bff:<client-id>:session:`).

Hydra's tokens are not in the `scs` session but in their own key,
`bff:<client-id>:tokens:<id>`, written only at login and by a refresh (C98).

To try it: open `http://male-city.bool.test/auth/login?return_to=/` or
`http://admin.bool.test/auth/login?return_to=/` and sign in. The apps themselves do not
use the BFF yet (7c-4).

## Logout and disabled accounts (7e, C101)

Sign out in an app posts to `/auth/logout`: the BFF ends its session and revokes the
refresh token, then sends the browser to Hydra's logout. Hydra hands its logout step to
the login service's `/logout`, which ends the browser's Kratos session and accepts the
logout; Hydra then notifies every other app of that login through **back-channel
logout** (`POST /auth/backchannel-logout` on each BFF, a logout token signed by Hydra),
and each BFF signs out the sessions of that login. The next sign-in asks for the
password. The BFF revokes the refresh token before reading Hydra's discovery, so it is
revoked even when discovery fails.

Sign-out works the same after the app's own session has ended (it idles out after 30
minutes): the BFF still sends the browser to Hydra's logout, without an ID token, so the
login service asks before ending the Kratos and Hydra sessions, instead of the browser
being signed straight back in (C126). A logout or consent challenge Hydra no longer has
(used, expired, or unknown) sends the browser on rather than failing.

Only a logout started by an app proceeds at once: the BFF sends Hydra the person's ID
token (`id_token_hint`), Hydra checks it belongs to the browser's login, and the logout
request is marked `rp_initiated`. A plain link to Hydra's logout, which any site can
make, is asked about first (C112): `/logout` sends the browser to `/logout/confirm`,
whose form posts back to `/logout` (refused unless `Sec-Fetch-Site` is `same-origin`,
or, without it, the `Origin` is the login service's). **Sign out** ends the login as
above and Hydra returns the browser to `urls.post_logout_redirect`, the login service's
home; **Stay signed in** rejects the logout request. The login service builds these
addresses from `IDENTITY_PUBLIC_URL`, since `request.nextUrl` carries the address the
server listens on, not the one the browser used.

The identity module's `Disable` makes the Kratos identity inactive (its logins are
refused) and deletes its sessions, then revokes each of its Hydra login sessions by ID
(which sends back-channel logout) and its consent sessions (revoking refresh tokens).
Hydra cannot list a subject's login sessions, so they are found through its consent
sessions, each of which records the login it came from; Hydra pages that list with a
`Link` header (`rel="next"`), parsed with `github.com/peterhellberg/link`. If a next page
cannot be followed, a warning is logged and those logins still lose their tokens, so
their browsers are signed out within the access-token lifetime instead of at once.
Browsers lose access at once; another client's access token works until it expires, at
most 10 minutes. `Disable` has no HTTP route until authorization (step 8).

## The BFF proxy (7c-3, C98)

Each BFF forwards `/api/*` to the API with `Authorization: Bearer` and the session's
access token; the browser's cookie and its own `Authorization` header never reach the
API. A request without a session gets the BFF's 401, which the app answers by sending
the browser to `/auth/login`. The BFF refreshes the access token when it expires within
a minute; concurrent requests share one refresh, and Hydra keeps a used refresh token
valid for a minute (`rotation_grace_period`) for races across processes. A refresh
Hydra refuses signs the session out (401); Hydra unavailable answers 503 and keeps the
session. A refresh saves the new tokens only if the session's tokens still exist
(`SET XX KEEPTTL`), so a sign-out or back-channel logout during the refresh is not
undone; that request gets 401 (C112). Refresh tokens last 12 hours, like the sessions,
and Hydra requires PKCE on every authorization code flow (C112).

Clients with their own tokens (mobile, partners, the Hydra test client) call the API at
`http://api.bool.test`: for example
`curl -H "Authorization: Bearer <token>" http://api.bool.test/api/auth/me`.

## Access tokens (7c-1, C91)

Hydra issues JWT access tokens valid for 10 minutes. The API accepts a caller only with
`Authorization: Bearer <access token>`: it checks the signature against Hydra's keys
(fetched once and cached), the issuer, the `erp-api` audience, and expiry (30 seconds
of allowance), and refuses ID tokens. go-oidc downloads the keys again for every token
that names an unknown key or fails its signature, to notice key rotation; the API's
key client (`auth.KeyClient`) allows one download every 10 seconds, so forged tokens
cannot make it fetch from Hydra on every request (C112; the BFF's verifiers use it
too). A client must be allowed the `erp-api` audience
and request it (`audience=erp-api`). Health checks are public; `GET /api/auth/me` (the
`identity/auth`, C92, C125) returns the caller's user (7d) and client. Every authenticated
answer carries `Cache-Control: no-store` (chi's `middleware.NoCache`, C112). To try it,
get a token with an OAuth2 client that sends PKCE (above) and call
`curl -H "Authorization: Bearer <token>" http://api.bool.test/api/auth/me` (app domains' `/api` goes through their BFF, C98).

## Users and caller context (7d, C94)

The `identity` module (`apps/api/internal/platform/identity`, C122) owns the `users` table:
the API's own ID for a person and copies of the Kratos identity's email, phone, and
name, and picture ([data model](../data-model/README.md)). Other tables reference
`users.id`, never the Kratos identity ID.

**Registering (C157).** A user is created or updated only by **`POST /api/auth/me`**,
called with the person's own access token: the API asks Cerbos (`identity:account`
`register`, their own account), then reads Hydra's public `/userinfo` with that token
(`ory/client-go`, the issuer's URL) and saves the email, phone, name, and picture the
consent granted; `/userinfo` must name the token's subject. Calling it again refreshes
the user. The BFFs call it in their sign-in callback; mobile and other clients call it
right after sign-in too. A token without the `email` and `phone` scopes gets 403
(`insufficient_scope`); a token Hydra no longer accepts (revoked, as for a disabled
account, C101) gets 401; a picture that is not an `http(s)` address is dropped. A
token whose `sub` is its own `client_id` (Hydra's `client_credentials`) is a client
acting for itself, with no account: Cerbos denies it.

**Reads never write (C157).** The `Authenticate` middleware
(`internal/platform/identity/auth`, C125) verifies the token, looks up the subject's
user, and keeps the caller (token and user) in the request context (`auth.FromContext`,
`auth.NewContext` for other entry points); it never creates one. A person who has not
registered gets 401 ("Register first: POST /api/auth/me."). If the user cannot be loaded
(the database unavailable), the request gets 503 without the cause. `GET /api/auth/me`
and every other GET only read. The authorization principal of a person carries their
account as `account_id`; before they register they are the role `account` (ID their
account), afterwards `user` (ID `users.id`).

## Accounts and development services (7a-1, C85)

Kratos v26.2.0 runs in Compose with its own `kratos` database and `erp_kratos` role
(`docker/postgres/init/20-kratos.sh`), migrated by the `kratos-migrate` service. Its
config is `docker/kratos/kratos.yml`, merged with `docker/secrets/dev/kratos.yml`
(database address, cookie and cipher secrets, provider client secrets) mounted as a
Compose secret. Browsers reach its public API at `http://identity.bool.test/kratos`;
the admin API (`http://kratos:4434`) is only on the internal network.

- **Accounts:** a new account has one email (`traits.email`), a contact phone, an optional
  name, and an optional picture (`traits.picture`, an `http(s)` address filled only from
  Google's `picture` claim; the login service sends it as a hidden field, never typed)
  (`registration.schema.json`). Extra emails are added through the admin API as
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
  Registration through Google signs in at once, so the mapper
  (`docker/kratos/oidc.google.jsonnet`) refuses a profile whose email Google does not
  report as verified (C112); Kratos shows that refusal on its error page.
- **Rate limits:** Traefik limits each client address on the login domain (C112): 20
  requests a second (bursts of 50) for the login service's pages and Kratos's public
  API, 10 a minute for Kratos's form submissions (`POST /kratos/self-service/*`), over
  which requests are held or refused with 429, and 100 a second for Hydra, since in
  development the BFFs' token requests reach it from one address. The login service's
  static assets (`/_next/`) have their own route without the limit (C127): they carry
  nothing sensitive, and a development page loads dozens of them, which used up the
  page limit within a few pages.
- **Headers:** the login service sends a per-page Content-Security-Policy with a nonce
  (`apps/identity/proxy.ts`, as the Next.js guide sets it; no `form-action`, because the
  login form's redirects go through Hydra to every app domain), and `nosniff`,
  `Referrer-Policy`, `X-Frame-Options: DENY`, and `Permissions-Policy` on every
  response (`next.config.ts`).

The phone is a contact number, not an identifier (C85): it is required, never used to
log in, and may be shared between accounts (a family or a front desk). Kratos does not
verify it, because Kratos keeps every verification address unique across accounts. If
a verified contact number is needed, the API will verify it with its own code. The SMS
channel to Mailpit stays configured for later SMS use.

## Login UI (7a-2, C86)

`apps/identity` serves the login pages at `http://identity.bool.test` (login,
registration, verification, recovery, settings, error). It is a Next.js app (C87):
each page's server loads its Kratos flow over the internal network
(`KRATOS_INTERNAL_URL`), passing on the browser's cookies, and Ory Elements renders
it; `theme/bool.tsx` replaces Elements' visual components with the Bool sign-in design
from `@workspace/ui`. A page without `?flow=` sends the browser to Kratos to start one;
expired or unknown flows start again. It does not use the removed `packages/auth` (C100). Hydra's consent
and logout steps are routes of the same app (C89, C101, C112).

## Open decisions

Decided: accounts and login methods (C85), one account with a membership per tenant
(C115), sessions, expiry, revocation, and disabled accounts (C96-C101, C126), BFF
callbacks and CSRF (C96). Still open:

- Login on verified custom domains, including self-hosted operation (step 7f).
- Tenant-specific access removal (ending a membership), with tenancy.
- Secure first-run setup (the operator tenant, C116) and integration credentials.
- Two-factor login for admin users (security review, before deployment).

Authentication must be evaluated together with [tenancy and domains](tenancy.md).
A shared parent-domain cookie does not solve login on unrelated customer domains.

## Architecture

Application ports separate use cases from the selected identity provider or session
implementation. Removing previous identity services from Compose neither selects
an alternative nor authorizes implementing credential handling without a design.

No provider ID is the application's user primary key (`users.id` is, C94). No credentials,
tokens, or full identity payloads belong in traces, cache keys, or ordinary logs.
