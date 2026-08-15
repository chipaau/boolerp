# 06 — Audit — Confirmation Checklist

**Status:** 🟡 In Review &nbsp;·&nbsp; Immutable, append-only business audit trail. `srs.md` + `use-cases.md` drafted.

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
- [ ] Scope confirmed &nbsp; [ ] Open questions resolved &nbsp; [ ] Use-case inventory complete
