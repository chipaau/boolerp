# Auth (Kratos + Chi + Cerbos)

**Separation of concerns:** Kratos = *who you are* (authN + sessions), Cerbos = *what you may do*
(authz), Chi = *everything else* (tenancy, RLS, business). No Ory Hydra (first-party only, no need
to be an OAuth2 server). No Node BFF.

## Identity & sessions — Ory Kratos

- Kratos is the identity service. `platform.users.id = Kratos identity id` (join-free). **No
  credentials in our DB** — passwords/passkeys/recovery live only in Kratos.
- Single identity pool is fine and *aligns* with "global identity spans tenants" — Kratos is
  tenant-agnostic; tenancy is entirely Chi's job. (Kratos OSS is not multi-tenant; we don't ask it to be.)
- Browser holds an **httpOnly Kratos session cookie**, scoped to the parent domain `.bool.mv` so it
  works across all `*.bool.mv` tenant subdomains. No token is ever readable by JS.
- **Onboarding** (matches `../erp` "nothing exists before payment"): self-service registration
  **disabled**; provisioning creates the identity via the Kratos **admin API**, mirrors to
  `platform.users`, creates the membership, and emails a **recovery link** for the owner to set
  their password.
- **Authentication is not admission.** A valid Kratos session proves only that someone controls an
  identity — never that they may use this system. Middleware **verifies** `platform.users` already
  has a row for the subject and **never creates one**: accounts exist solely because an operator or
  tenant admin provisioned them. An authenticated subject with no row gets **403** (not 401 — the
  session is valid, so 401 would loop them through a login that keeps succeeding). This holds
  independently of Kratos config, so enabling OIDC — or a mis-set `registration.enabled` — can
  never turn "can log in with Google" into "is a user of the ERP".

## API — Chi, stateless

- Chi holds **no session state**; it validates each request by forwarding the cookie to Kratos
  `GET /sessions/whoami` (200 → identity; 401 → redirect to login). API is stateless; **Kratos is
  the stateful session authority** — that split is correct, and it gives **instant revocation**
  (deactivate identity / revoke sessions via Kratos admin → next `whoami` fails).
- Do **not** use a trusted-header handoff (Chi trusting `X-User-Id` from a BFF) unless Chi is
  strictly unreachable except via that BFF — it's an impersonation footgun. Prefer Chi validating
  the session itself.
- Authorization: call **Cerbos** live per request (roles/capabilities from `platform` schema).
  Never bake permissions into a long-lived token — they must take effect immediately.

## Topology

- **Same-origin per subdomain:** the reverse proxy routes, on `malecouncil.bool.mv`,
  `/` → SPA, `/auth/*` → Kratos public, `/api/*` → Chi. Result: no CORS, cookie "just works".
- Kratos **admin** API and Cerbos are internal-only (never proxied to the internet).
- Self-hostable unit: `postgres` (app + kratos DBs) · `redis` (cache + rate-limit) · `kratos`
  (+ migrate) · `cerbos` · `api` (Chi) · static SPA. One `compose up`.
- Validate `return_to` against Kratos `allowed_return_urls` (`https://*.bool.mv`) — open-redirect guard.
