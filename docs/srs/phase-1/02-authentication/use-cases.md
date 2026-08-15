# 02 — Authentication & Sessions — Use Cases

**Status:** 🟡 In Review. Actors: **Person** (prospective/active user), **App** (`apps/app` SPA),
**Kratos** (identity/session authority), **Chi** (stateless API), **Operator** (internal-tenant staff).
Convention: the App renders custom screens and drives Kratos **browser self-service flows**; Chi only
validates sessions (`whoami`) and never sees credentials.

---

## UC-AUTH-01 — Activate account (set first credential)
- **Actor:** Person (owner or invited member) · **Trigger:** clicks the activation/recovery link emailed at provisioning.
- **Preconditions:** identity exists in Kratos (created via admin API at provisioning); no credential set yet.
- **Main flow:**
  1. App opens the recovery flow from the link token.
  2. Person sets a password (and may enroll a passkey/TOTP).
  3. Kratos marks the credential set + email verified; issues a session cookie.
  4. App lands on `/bootstrap` → the tenant they were provisioned into.
- **Exceptions:** expired/used link → offer "resend activation"; weak password → Kratos validation error shown inline.
- **Postcondition:** Person can log in; `platform.users` already mirrors the identity.

## UC-AUTH-02 — Log in with email + password
- **Actor:** Person · **Trigger:** submits the login form on `malecouncil.bool.mv/login`.
- **Preconditions:** active identity with a password credential.
- **Main flow:**
  1. App initializes a Kratos login flow, renders fields, submits email+password.
  2. Kratos verifies; if MFA is enrolled/required → **UC-AUTH-04**.
  3. On success Kratos sets the httpOnly session cookie (`.bool.mv`).
  4. App calls `GET /api/v1/bootstrap`; Chi validates via `whoami` and returns context.
- **Exceptions:** bad credentials → generic error (no user enumeration); throttled after N attempts (lockout policy TBD); unverified email → prompt **UC-AUTH-07**.
- **Postcondition:** authenticated session; App renders the tenant.

## UC-AUTH-03 — Log in with passkey (WebAuthn)
- **Actor:** Person · **Trigger:** chooses "Sign in with passkey".
- **Preconditions:** a passkey is registered for the identity.
- **Main flow:** App starts a passkey login flow → browser WebAuthn prompt → Kratos verifies assertion → session cookie issued → `/bootstrap`.
- **Exceptions:** no passkey on device → fall back to password; user cancels → return to login.
- **Postcondition:** authenticated session (passwordless).

## UC-AUTH-04 — Complete MFA / TOTP challenge
- **Actor:** Person · **Trigger:** login step-up when TOTP is enrolled/required.
- **Main flow:** App shows the TOTP prompt → Person enters the 6-digit code → Kratos verifies → session reaches the required assurance level (AAL2).
- **Exceptions:** wrong code (retry/throttle); lost device → recovery/backup-code path (**confirm backup codes in scope**).
- **Postcondition:** session at the required assurance level.

## UC-AUTH-05 — Log in via OIDC (social / national eID)
- **Actor:** Person · **Trigger:** chooses an OIDC provider button.
- **Preconditions:** provider configured in Kratos.
- **Main flow:**
  1. App starts the OIDC login flow; Kratos redirects to the provider.
  2. Person authenticates at the provider; returns to Kratos; Kratos verifies + creates/links the identity.
  3. Session cookie issued; Chi **JIT-upserts** `platform.users` on first `whoami`.
- **Exceptions:** provider denies/cancels → back to login; email already exists → link vs. error (**confirm linking policy**).
- **Postcondition:** authenticated session; identity linked to the OIDC provider.

## UC-AUTH-06 — Recover access (forgot password)
- **Actor:** Person · **Trigger:** "Forgot password".
- **Main flow:** App starts a recovery flow → Person enters email → Kratos emails a one-time code/link → Person sets a new password → session issued.
- **Exceptions:** unknown email → same neutral response (no enumeration); expired code → resend.
- **Postcondition:** new password set; prior sessions optionally invalidated (**confirm**).

## UC-AUTH-07 — Verify email
- **Actor:** Person · **Trigger:** post-registration/activation or email change.
- **Main flow:** Kratos emails a verification code/link → Person confirms → email marked verified.
- **Exceptions:** expired → resend. **Postcondition:** verified email (gates login if required).

## UC-AUTH-08 — Validate session on each API request *(system)*
- **Actor:** Chi · **Trigger:** any `/api/*` request.
- **Main flow:** Chi forwards the session cookie to `whoami`; 200 → identity into `context.Context`; then tenant resolution + RLS + Cerbos.
- **Exceptions:** 401 → App redirects to login preserving the deep link (**UC-AUTH-12**).
- **Postcondition:** request proceeds with an authenticated principal, or is rejected.

## UC-AUTH-09 — Log out (current session)
- **Actor:** Person · **Main flow:** App calls Kratos logout → session invalidated, cookie cleared → App returns to login.
- **Postcondition:** current session ended; next `whoami` is 401.

## UC-AUTH-10 — Log out everywhere
- **Actor:** Person (or admin on their behalf) · **Main flow:** revoke **all** sessions for the identity via Kratos → every device's next `whoami` fails.
- **Postcondition:** all sessions for that identity are dead.

## UC-AUTH-11 — Instant revocation on disable/suspend *(system)*
- **Actor:** Chi/Operator · **Trigger:** a user is disabled (03) or a tenant is suspended (04).
- **Main flow:** Chi calls the Kratos **admin API** to deactivate the identity and/or revoke its sessions → next `whoami` returns 401.
- **Postcondition:** access removed within one request cycle (no waiting for token expiry).

## UC-AUTH-12 — Preserve deep link through login
- **Actor:** Person · **Trigger:** hits a protected URL while unauthenticated.
- **Main flow:** App captures the full path into `return_to` → login → Kratos validates `return_to` against `allowed_return_urls` → after auth, App navigates to the original URL.
- **Exceptions:** invalid/off-domain `return_to` → ignored, land on default (open-redirect guard).
- **Postcondition:** Person lands where they intended.

## UC-AUTH-13 — Manage credentials (settings)
- **Actor:** Person · **Trigger:** opens account settings in `apps/app`.
- **Main flow:** via a Kratos settings flow: change password; enroll/remove **TOTP**; add/remove **passkeys**; link/unlink **OIDC**; (view active sessions).
- **Exceptions:** sensitive changes may require re-auth (AAL step-up).
- **Postcondition:** credentials updated; changes take effect immediately.

## UC-AUTH-14 — Operator support access (impersonation)
- **Actor:** Operator (internal-tenant staff) · **Trigger:** starts a support session against a target user/tenant from **`apps/admin`**.
- **Preconditions:** operator holds the support capability; four-eyes approval per policy; target identified.
- **Main flow:**
  1. Operator requests support access (reason, target, duration) in `apps/admin`.
  2. A second operator approves (four-eyes); a **time-boxed** support-access grant is recorded.
  3. Operator acts as the user within the granted scope/window; **every action is audited** with the real operator identity + impersonation context.
  4. Grant auto-expires; access ends.
- **Exceptions:** no approval → denied; expiry mid-session → access revoked immediately; target tenant suspended → blocked.
- **Postcondition:** support performed under a fully audited, expiring grant; **no standing access**.
- **Notes:** audit records operator ≠ subject. Data model: a support-access grant record (ties to 05 authorization + 06 audit).

---

## ⚠️ Resolved / remaining
- ✅ MFA backup codes · OIDC verified-email linking · recovery invalidates sessions · MFA enforcement · session timeouts — confirmed in `srs.md`.
- ✅ Support/impersonation — Phase 1 (UC-AUTH-14).
- [ ] OIDC launch providers (deploy-time config; named later).
- [ ] UC-AUTH-14 support-access **data model** — confirm with 05 authorization + 06 audit.
