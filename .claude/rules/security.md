# Security rules

- The project's security standard is **OWASP ASVS 5.0, Level 2** (C111), with Level 3
  where cheap for authentication, sessions, and the admin console. Check designs and
  changes against the relevant ASVS requirements, and record exceptions with their reason.
  Build practices follow NIST SSDF (SP 800-218). Open findings are tracked in
  [the security review](../../docs/security/README.md).
- Flag security implications when proposing or reviewing changes. If a change
  affects authentication, authorization, input validation, data exposure, or
  cryptographic boundaries, state the risk and mitigation explicitly.
- Follow the OWASP Top 10 protections (awareness; ASVS is the requirement set): validate and sanitize all external input,
  use parameterized queries, enforce least privilege, and prevent injection
  (SQL, command, header, log).
- Never log, cache, or return credentials, tokens, session identifiers,
  private employee data, or unredacted error internals.
- Treat hostnames, tenant identifiers, and request headers as untrusted input
  until verified by the application.
- Use constant-time comparison for secrets and tokens. Do not roll custom
  cryptography or authentication schemes.
- Apply transport security (TLS, secure cookies, strict headers) at every
  layer that handles user data.
- Prefer deny-by-default for access control; require explicit grants rather
  than absence of denial.
- When a dependency or design choice has a known security trade-off, document
  it in the relevant component doc and reference it in the decision register.
