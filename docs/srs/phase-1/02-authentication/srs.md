# 02 — Authentication & Sessions — SRS

**Status:** 🟢 Confirmed (2026-08-16) &nbsp;·&nbsp; Engine: **Ory Kratos** (authN + sessions). Chi validates via
`GET /sessions/whoami`. **Custom UI** in `apps/app` calling Kratos self-service **browser flows**.

## Confirmed decisions (2026-08-13)
- **Methods:** email+password, **TOTP MFA**, **passkeys (WebAuthn)**, **OIDC** (social / national eID).
- **UI:** custom login/recovery/settings screens in `apps/app` (React + shadcn) against Kratos flow APIs.
- **First admin:** created via **interactive web setup** on a fresh install (spec'd in 01 Platform foundation).
- Session cookie: httpOnly, Secure, `SameSite=Lax`, domain `bool.mv` (works across tenant subdomains).

## Functional requirements
| ID | Requirement |
|---|---|
| FR-AUTH-01 | Log in with email + password → Kratos issues the httpOnly session cookie. |
| FR-AUTH-02 | Log in with a **passkey** (WebAuthn), passwordless. |
| FR-AUTH-03 | Prompt a **TOTP** second factor when the identity has MFA enrolled/required. |
| FR-AUTH-04 | Log in via **OIDC** provider; JIT-upsert `platform.users` from the identity. |
| FR-AUTH-05 | **Activate** an account: owner/member sets their first credential via an emailed recovery link. |
| FR-AUTH-06 | **Recover** access (forgot password) via one-time code/link. |
| FR-AUTH-07 | **Verify** email address. |
| FR-AUTH-08 | Validate the session on every API request via `whoami`; 401 → redirect to login. |
| FR-AUTH-09 | **Log out** current session; **log out everywhere** (revoke all sessions for the identity). |
| FR-AUTH-10 | **Instant revocation** when an identity is disabled or its tenant is suspended (Kratos admin API → next `whoami` fails). |
| FR-AUTH-11 | Preserve the requested deep link through login via `return_to`, **validated** against `allowed_return_urls` (`https://*.bool.mv`). |
| FR-AUTH-12 | Self-service **settings**: change password, enroll/remove TOTP, add/remove passkeys, link/unlink OIDC. |
| FR-AUTH-13 | **Operator impersonation** (from `apps/admin`): time-boxed, four-eyes, fully audited support access acting as a user. |

## Non-functional / policy — **confirmed 2026-08-13**
- Session: absolute **12h** + **30-min sliding idle timeout**.
- Brute-force: Kratos throttling on; lockout thresholds tuned at hardening (Kratos defaults to start).
- MFA: **optional per user**; **enforced for internal/operator roles** (ties to 05).
- MFA **backup/recovery codes**: in scope.
- OIDC email collision: auto-link only on a **verified matching email**; otherwise separate identity.
- Password recovery/change: **invalidates all other sessions**.
- CSRF: Kratos flows CSRF-protected; app API uses a double-submit token on unsafe methods.
- No credentials/tokens reach the browser except the opaque httpOnly session cookie.

## Remaining
- [x] **eFaas** (Maldives national eID) is a **Phase-1** OIDC provider; verified identity → `user_efaas_identities` (see DB-FOUNDATION). Other OIDC providers remain deploy-time config.
- [ ] Concurrent-session limits — default none; revisit at hardening.
- [ ] UC-AUTH-14 support-access **data model** (grant record) — confirmed alongside 05 authorization + 06 audit.

## Use cases
See [`use-cases.md`](use-cases.md) — UC-AUTH-01 … UC-AUTH-14.
