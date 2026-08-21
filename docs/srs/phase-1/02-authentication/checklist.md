# 02 — Authentication & Sessions — Confirmation Checklist

**Status:** 🟢 Confirmed (2026-08-16) &nbsp;·&nbsp; Engine: Ory Kratos (authN + sessions) · Chi validates via `whoami` · authoritative use-case inventory is `use-cases.md` (**UC-AUTH-01 … UC-AUTH-14**, incl. OIDC + operator impersonation)

## Scope
- **In:** login, session validation, recovery (password reset), email verification, MFA/TOTP,
  passkeys, logout, session revocation, activation (owner sets password via recovery link).
- **Out (other components):** who-belongs-to-which-tenant (→ 03 Identity & membership),
  what-you-may-do (→ 05 Authorization), tenant suspension policy (→ 04, triggers revocation here).

## Candidate use cases (confirm this inventory is complete)
- UC-AUTH-01 — Owner activates account (sets password via emailed recovery link after provisioning)
- UC-AUTH-02 — Log in with email + password
- UC-AUTH-03 — Log in with passkey
- UC-AUTH-04 — MFA/TOTP challenge on login
- UC-AUTH-05 — Forgot password → recovery
- UC-AUTH-06 — Email verification
- UC-AUTH-07 — Per-request session validation (`whoami`), 401 handling
- UC-AUTH-08 — Log out (current session)
- UC-AUTH-09 — Log out everywhere (revoke all sessions for identity)
- UC-AUTH-10 — Instant revocation when a user is disabled or a tenant is suspended
- UC-AUTH-11 — Deep-link preserved through login (`return_to`, validated)
- UC-AUTH-12 — Self-service settings: change password, manage MFA / passkeys

## ⚠️ Likely-missing use cases — confirm in or out of Phase 1
- Account lockout / brute-force throttling (Kratos config)
- Idle/absolute session timeout policy
- Concurrent-session limits
- Social / national eID (OIDC) login — docs say `oidc` disabled initially; confirm
- Support/impersonation access (erp's **time-boxed, audited** support grants) — Phase 1 or later?
- **Self-host first-run:** how the very first admin identity is created on a fresh box (→ 01)

## Open questions
- [x] Methods: password + **MFA/TOTP + passkeys + OIDC** (confirmed 2026-08-13).
- [x] UI: **custom screens in `apps/app`** against Kratos flows.
- [x] First-run first admin: **interactive web setup** (spec in 01).
- [x] MFA optional per user; **enforced for internal/operator roles**.
- [x] Session **12h + 30-min idle**.
- [x] Support/impersonation: **Phase 1** — UC-AUTH-14, initiated from **`apps/admin`**.
- [x] MFA backup codes (yes); OIDC link on **verified email**; recovery **invalidates** other sessions.
- [ ] OIDC launch providers — deploy-time config; named later.
- [ ] UC-AUTH-14 support-access **data model** — confirm with 05 authorization + 06 audit.

## Data-model touchpoints
- Kratos owns credentials + sessions (external). `platform.users` mirrors identity (`id` = Kratos subject).
- No app `sessions` table (Kratos is the session authority).

## Sign-off
- [x] Scope confirmed &nbsp; [x] Open questions resolved &nbsp; [x] Use-case inventory complete &nbsp; [x] Data model confirmed (no app tables; `users` mirror only, Kratos owns sessions/credentials)
