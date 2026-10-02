# Security review

Standard: OWASP ASVS 5.0, Level 2 (C111). This page tracks the findings of the review of
2026-10-02 and their status. ASVS references are to chapters (V6 Authentication, V7 Session
Management, V10 OAuth and OIDC, …); check the specific requirements when fixing.

The review covered the API, the BFF, the login service with Kratos and Hydra, the browser
apps, and CI, containers, and the supply chain, with `govulncheck` and `pnpm audit`. No
critical or high-severity vulnerability was found in the code; several medium-severity ones
were, two of them reproduced. The fixes are recorded in C112; a fixed finding's test or
check is in the change that fixed it.

## Findings

| # | Finding | Where | ASVS | Severity | Status |
| --- | --- | --- | --- | --- | --- |
| 1 | Open redirect after sign-in: a control character in `return_to` (`/%09/evil`) passes the check and browsers drop it, giving `//evil` (reproduced) | BFF login, `@workspace/session` | V15, V1 | Medium | Fixed (C112) |
| 2 | Logout without confirmation: any site can send a browser to Hydra's logout, which signs it out everywhere (reproduced) | Login service `/logout` | V10, V7 | Medium | Fixed (C112) |
| 3 | Google sign-up can create an account with an unverified email | Kratos Google mapper, registration hooks | V6 | Medium | Fixed (C112) |
| 4 | CSV formula injection in exports | `@workspace/ui` `toCsv`, admin ledger, Control Centre units | V1 | Medium | Fixed (C112) |
| 5 | Forged tokens make the API re-download Hydra's keys on every request | API `auth` verifier | V9 | Medium | Fixed (C112) |
| 6 | Next.js advisory GHSA-vcvr-r3jv-pc5j (RCE in `next/og`); not used, but 16.3.5 is affected | `apps/identity`, `apps/website` | V15 | Medium | Fixed (C112) |
| 7 | No rate limiting on login, registration, recovery, verification, or the token endpoint | Traefik routes | V6 | Medium | Fixed (C112) |
| 8 | No security headers on the login service (CSP, framing, referrer) | `apps/identity` | V3 | Medium | Fixed (C112) |
| 9 | Kratos and Hydra admin APIs (no authentication) reachable from the shared `proxy` network; service names can collide with other projects' | Compose networks | V13 | Medium | Accepted for development; production requirement recorded (C112) |
| 10 | Refresh tokens live 30 days (sessions 12 hours); Hydra does not require PKCE | Hydra config | V10 | Low | Fixed (C112) |
| 11 | A refresh racing sign-out can bring tokens back without expiry (`SET KEEPTTL` on a deleted key) | BFF session | V7 | Low | Fixed (C112) |
| 12 | No `Cache-Control: no-store` on personal data (`/api/auth/me`, proxied API responses) | API, BFF proxy | V14 | Low | Fixed (C112) |
| 13 | Logout skips revoking the refresh token when discovery fails | BFF logout | V7, V10 | Low | Fixed (C112) |
| 14 | The account page's "Sign out" ends only the Kratos session | Login service | V7 | Low | Open |
| 15 | Deleted or disabled accounts get 503, not 401; a disabled account's first request still creates its user; a machine client's token would be treated as a person | API `auth`, identity module | V6, V8 | Low | Open |
| 16 | Telemetry labels from client headers (`Host`, leftmost `X-Forwarded-For`) | API, BFF tracing | V16 | Low | Open |
| 17 | No request deadline below the write timeout | API | V15 | Low | Open |
| 18 | National ID number stored in `localStorage` | Admin notifications | V14 | Low | Open |
| 19 | Anonymous `/auth/login` creates a Redis entry in a no-eviction store | BFF login | V7 | Low | Open |
| 20 | CI runs no vulnerability, image, or secret scanning | CI | SSDF | Medium | Open |
| 21 | Actions and base images pinned by tag, not SHA or digest; `corepack@latest`; `latest` versions for TanStack | CI, Dockerfiles, `package.json` | SSDF | Medium | Open |
| 22 | `checkout` keeps credentials; `.gitignore` misses `.env.*`; e2e installs without the lockfile | CI, repository | SSDF | Low | Open |
| 23 | Mock data pairs real Maldivian organisations with personal-looking data | Admin mocks | V14 | Low | Open |

## Before any real deployment

Acceptable in development only; a production configuration and checklist must cover them:
no `--dev` on Kratos and Hydra; HTTPS everywhere with HSTS; Secure cookies
(`__Host-session`); TLS to PostgreSQL and Redis; freshly generated secrets (everything in
`docker/secrets/dev/` is public); no `dev-test-client`, stand-in Google provider, or
Mailpit; real SMTP and SMS providers; `next start` instead of `next dev`; admin APIs on a
private network; two-factor login for admin users.

## Notes on the fixes

- 2: the confirmation is skipped only for logouts Hydra marks `rp_initiated` (an app's
  logout with its ID token).
- 3: Kratos shows the refusal on its error page as an internal error with the mapper's
  message; a friendlier page is later work.
- 5: go-oidc has no limit of its own (a verified gap); `auth.KeyClient` adds one.
- 7: over the limit, Traefik first holds a request (up to a few seconds), then answers
  429. Limits per account are not enforced yet.
- 9: development keeps the shared `proxy` network as it is; production must keep the
  admin APIs on a private network ([deployment](../platform/deployment.md)).
- 10: enforcing PKCE stops `hydra perform authorization-code`, which sends none, from
  signing in with `dev-test-client`.

## Checked and not an issue

- The BFF callback's `code` and `state` in request logs are redacted (C91).
- No dangerous HTML rendering in the apps; no tokens in the browser; parameterized SQL;
  no client-supplied identity or tenant headers trusted; non-root release images.
