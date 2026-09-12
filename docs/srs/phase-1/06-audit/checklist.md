# 06 — Audit — Confirmation Checklist

**Status:** 🟡 Partially Implemented (2026-09-12) &nbsp;·&nbsp; Immutable, append-only business audit
trail. `audit_log` exists (migration `00009_audit.sql`), RLS-scoped, append-only via a real DB
trigger (`trg_audit_log_append_only`, not just app-code omission). UC-AUD-01 works for tenant
lifecycle only (`internal/tenancy`'s `Provision`/`Suspend`/`Reactivate`/`Archive` each write their
own audit row atomically) — **not** a generic capture-everything interceptor yet; every other
auditable entity (once one exists) needs its own call to `internal/audit.Record` until one is built.
UC-AUD-02 (view/search) has no UI/API yet — capture only. Month partitioning
`(tenant_id, month)` was not built — a single table for now, disproportionate at current volume.
`event_outbox` was not created.

## Scope
- **In:** `audit_log` capture (create/update/delete/restore) with actor, entity, before/after,
  request_id, ip; append-only (no update/delete ever); month partitioning by `(tenant_id, month)`;
  retention ≥ 7 years; who-can-read.
- **Out:** technical tracing/logs (→ 07); event publishing (`event_outbox`) — related, confirm ownership.

## Candidate use cases
- UC-AUD-01 — A write to any auditable entity records a before/after audit row in the same tx
- UC-AUD-02 — View/search audit trail (tenant-scoped; who may)
- UC-AUD-03 — Audit survives tenant suspension/archival (retention)
- UC-AUD-04 — Visibility/permission changes are audited (link to 04/05)

## ⚠️ Likely-missing / confirm
- `before/after`: full row vs changed-columns (+ full snapshot on delete)? (erp open question)
- Retention/archival window + partition drop policy (target ≥ 7y)
- Is capture automatic (interceptor/middleware) or per-handler?
- Does `event_outbox` belong here or in 01/07?

## Open questions
- [x] Payload: **changed-columns + full snapshot on delete**.
- [x] Capture: **automatic** at the tx boundary (not per-handler).
- [x] Retention **≥ 7y**; archival mechanism deferred; `event_outbox` is a **foundation** (01) mechanism.
- [ ] Parent visibility of descendants' audit? (default: own-tenant only).
- [ ] Archival mechanism + timing for cold partitions.

## Data-model touchpoints
- `audit_log`, `event_outbox` (group E).

## Sign-off
- [x] Scope confirmed (capture mechanism) &nbsp; [ ] Open questions resolved &nbsp; [ ] Use-case inventory complete
- [~] **Partially implemented** (2026-09-12): `audit_log` + append-only trigger + `internal/audit`,
  wired to tenant lifecycle only. Tested: `internal/db/sqlc/audit_integration_test.go` (append-only,
  RLS isolation), `internal/tenancy/lifecycle_integration_test.go` +
  `internal/tenancy/provision_integration_test.go` (capture correctness). No generic capture layer,
  no read/search surface, no partitioning, no `event_outbox`.
