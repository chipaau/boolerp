# Sequential roadmap

Updated: 2026-09-28.

This is an implementation sequence, not approval to implement all steps.
Resolve one decision at a time using the [decision register](decisions/README.md).

| Stage | Outcome | Current status |
| --- | --- | --- |
| 0. Documentation baseline | Fresh branch, current scope/decisions, archived history, centralized agent rules, four-service Compose | Documentation/configuration milestone; no new application implementation |
| 0a. Executable scaffold | Preserve apps/api.bak; start the rebuild with a simple chi server (platform step 0) | Done on 2026-09-28 (platform step 0) |
| 1. Tenant model | Agree what a tenant represents and its relationship to a licensed customer | Next discussion, D01 |
| 2. Platform implementation | Deliver the increments below; resolve D02–D12 as needed and approve tables individually | Reset on 2026-09-28 (C24); steps 0 and 1a done, step 1b next |
| 3. Platform acceptance | Prove protected operations, audit, tracing, caching, domains, and same-release SaaS/self-host installation, licensing, upgrades, and restore | Not started |
| 4. Employee operation | Resolve D11 and implement one approved employee operation through domain/application/adapters, including access, audit, and trace | Not started |
| 5. Cache-backed employee read | Prove scoped Redis caching, invalidation, and failure behavior for a concrete employee read | Not started |
| 6. Frontend integration | Define/generate client contract, connect frontend, add browser validation, package assets as agreed | Deferred |

Deployment constraints inform earlier choices; postponing implementation does not
mean ignoring custom-domain or self-host requirements during identity design.

## Platform delivery plan

Status: the earlier implementation of steps 0–3 was removed on 2026-09-28 so the
API can be rebuilt from scratch for understanding (C24). The tool selections from
those steps still stand; no step is currently implemented. This breaks
the platform stage above into small increments, including the backend deployment
proof, so there is a clear platform milestone before HRMS.

Technical infrastructure belongs in `internal/platform/`. Policy and business
capabilities belong in `internal/modules/identity`, `tenancy`, `authorization`,
and `audit`. Each increment should deliver usable behavior and its relevant checks,
not just more directories.

| Step | Add | Completion check | Decisions needed before implementation |
| --- | --- | --- | --- |
| 0 | **Simple chi server:** Go module, `cmd/api` entry point, a chi router, and `GET /api/healthz` liveness, built and run in Docker. | The server builds and runs in Docker and liveness responds. **Done** (2026-09-28): gofmt/vet pass in Docker; the Compose `api` service is healthy and `http://cyryx.bool.test/api/healthz` returns `200 .` through Traefik. | C14, C19, C24. |
| 1a | **Runtime configuration:** typed configuration loaded from the environment, validation, safe error messages, and explicit dependency wiring. | Valid settings start the server; invalid settings fail at startup without disclosing values. **Done** (2026-09-28) for `APP_ENV` and `APP_PORT`: unit tests cover defaults, empty values, invalid values and non-disclosure; the Compose service is healthy and a bad `APP_PORT` stops startup with `APP_PORT: invalid int`. | C16 contract, rebuilt under C24; C26, C27. |
| 1b | **Logging:** `slog` structured logging, startup/shutdown logs, format/level settings, and redaction of sensitive attributes. | Logs are structured and sensitive attributes are redacted. | C16 contract, rebuilt under C24. D07 remains open for tracing. |
| 2 | **HTTP foundation on chi:** use `chi/middleware` and go-chi packages first (for example RequestID, Recoverer, Timeout, RequestSize, CleanPath/RedirectSlashes, ClientIPFrom*, `go-chi/cors`); write custom code only for documented gaps. Covers graceful shutdown, shared error responses, request correlation, panic recovery, body limits, timeouts, canonical redirects, and proxy/CORS rules needed by the selected deployment. | HTTP and real TCP checks prove error/ID consistency, request limits, recovery, network deadlines, shutdown draining, and the initial origin/proxy policy. | C17, C19, C23; the [HTTP contract](platform/http.md) is the target. Identity-specific browser protections remain part of D04. |
| 3 | **PostgreSQL foundation:** pool lifecycle, connection deadlines, readiness, migration command, and separate runtime/migration privileges. | A fresh PostgreSQL cluster proves the pool, readiness, a test-only Goose migration, and that the runtime role can perform DML but cannot run DDL or access migration history. | C18: pgx/v5 pgxpool and Goose; sqlc deferred to the first approved table. The [PostgreSQL contract](platform/postgres.md) is the target. |
| 4 | **Redis foundation:** client lifecycle, configuration, deadlines, and dependency health behavior. | Real Redis connection, cancellation, cleanup, and outage behavior verified. This proves connectivity only. | Redis client and operational failure/readiness policy from D08. |
| 5 | **Request tracing:** propagation, HTTP spans, log correlation, PostgreSQL/Redis instrumentation, and configurable export. | A request can be followed across infrastructure; sensitive payloads are absent; exporter failure follows the agreed policy. | Remaining D07 choices, including self-hosted defaults. |
| 6 | **Tenancy and transaction boundary:** approved tenant persistence, trusted tenant context, isolated reads/writes, and application-owned transactions. | Cross-tenant reads/writes, missing context, rollback, and pooled connection reuse tested; use the restricted runtime role if RLS is selected. | D01, D02, the transaction portion of D06, and the required tenancy tables. |
| 7 | **Identity and sessions:** selected provider/session adapters, account provisioning/status, login/logout, recovery, validation, and revocation. | Real adapter integration proves the agreed login lifecycle, disabled-account behavior, and expired/revoked sessions. | D04 and required identity tables; validate the custom-domain and self-hosted login design now. |
| 8 | **Memberships and authorization:** tenant access, permissions, record visibility, and access administration through module-owned application contracts. | Denied, missing, and unavailable access decisions are enforced from HTTP and direct application calls; tenant access removal meets the agreed revocation guarantee. | D05, membership ownership/lifecycle under D01/D04, and required membership/authorization tables. |
| 9 | **Audit and the first protected platform operation:** durable audit capture, transaction participation, scoped audit reads, and the agreed failure/denial recording path. Wire one approved platform mutation through the completed modules. | Successful change and required audit evidence commit together; audit failure rolls back the change; denied attempts follow their separate policy; audit reads and mutation privileges are constrained. | Remaining D06 choices, audit tables, and the concrete platform operation. |
| 10 | **Tenant and domain lifecycle:** remaining approved tenant administration, default domains, custom-domain ownership verification, activation/revocation, host resolution, and domain-aware login. | Unknown/unverified hosts fail safely; domain ownership and lifecycle checks work; login/callback/logout work on default and unrelated custom domains. | Domain lifecycle and tables under D02/D04; TLS/proxy responsibilities under D10. |
| 11 | **One real cached platform read:** select an approved read from the completed modules, then add scoped keys, TTL, invalidation after commit, and recovery. | Real Redis tests prove tenant/visibility separation, expiry, invalidation, rollback behavior, and the approved outage fallback. | Remaining D08 choices for that specific read. Tenant metadata is a candidate; security data requires an explicit revocation policy. |
| 12 | **Required background work:** implement only jobs required by an approved platform flow, with execution authority, retries, idempotency, and recovery. | Duplicate delivery and partial failure are safe; tenant/access context is enforced at execution; shutdown and retry behavior are verified. | D09 and any queue/outbox tables. Bring this slice forward if provisioning or domain verification requires it. If no platform flow needs a worker, record that decision instead of building an unused queue. |
| 13 | **Deployment and licensing foundations:** secure first-run setup, same-release SaaS/self-host configuration, agreed license enforcement, installation, migrations, upgrades, backup, and restore. | Install and exercise both deployment modes from the same API release; verify agreed license/offline/expiry behavior and restore an isolated test installation. | D10, required licensing persistence, and earlier tenant/identity decisions. |
| 14 | **Platform acceptance:** run the complete backend flow and failure cases, check module boundaries, and document operation/recovery. | All applicable completion checks below pass. | Close or explicitly defer remaining platform questions with their limits recorded. |

Steps 6–9 form the first protected application slice. Early module adapters can be
verified in isolation, but expose platform administration only when tenancy,
authorization, and required audit capture are all enforced. Secure bootstrap must
have explicit authority; it must not become an authentication bypass.

The product decisions remain sequential: **D01 is the next product-model
discussion.** Infrastructure increments 1–5 can be agreed independently without
assuming tenant semantics. Provider/deployment constraints inform design early;
their later implementation position does not postpone those design checks.

## Working one increment at a time

1. Pick the next bounded behavior and resolve only the decisions it needs. Record
   confirmed choices in the [decision register](decisions/README.md).
2. For persistence, review and approve the required tables individually in
   dependency order using the [data-model checklist](data-model/README.md).
3. Implement the smallest complete increment with explicit wiring and the
   existing domain/application/adapter boundaries.
4. Run the relevant Docker-based checks from the [verification strategy](testing.md),
   update the component document, and record evidence before marking it done.

**Next implementation increment: step 1b, logging.** Each step should be small enough to run and
understand before moving on. Application tables remain subject to individual approval.

## When the platform is done

- An authenticated caller can perform the approved platform operation in an
  allowed tenant; unauthorized and cross-tenant attempts fail, including calls
  made outside HTTP.
- Required changes and audit evidence have the agreed atomicity; audit history
  is protected and queryable with the correct scope.
- Logs and traces explain failures without exposing credentials or private
  payloads. A real cached read satisfies isolation and consistency checks.
- Default/custom-domain login, access revocation, and any required background
  execution have integration evidence against the selected adapters.
- The same API release supports the agreed SaaS/self-hosted setup and licensing
  behavior, with verified installation, upgrade, and restore instructions.

This is a backend platform milestone. The following milestone is D11 and the
first complete employee operation, followed by an employee-specific cached read.
Those steps prove the backbone against HRMS rules; frontend integration remains
deferred. Broader business modules and a complete production rollout are outside
this plan.

The previous API is preserved in `apps/api.bak`. It is not a source of inherited
implementation decisions, and its migrations must not be used for the new API.
Keep existing databases intact unless a separate data migration/reset is authorized.

Do not expand the business scope beyond employee records or build a generic
framework before the first complete operation proves the backbone.
