# 06 — Audit — SRS

**Status:** 🟡 In Review &nbsp;·&nbsp; Immutable, append-only **business audit trail**. Distinct from
technical tracing/logging (→ 07). `event_outbox` (transactional outbox for event *publishing*) is a
**foundation** mechanism (01); this component owns `audit_log`.

## Confirmed decisions (2026-08-13)
- **Automatic capture** for auditable entities (in the **same transaction** as the change) — not per-handler calls.
- Payload = **changed-columns diff** + a **full snapshot on delete**.
- Append-only: **no updates or deletes, ever**; partitioned by `(tenant_id, month)`.
- Retention **≥ 7 years**; archival mechanism deferred (partitions retained meanwhile).

## Functional requirements
| ID | Requirement |
|---|---|
| FR-AUD-01 | `audit_log` is **append-only** — no update/delete paths exist. |
| FR-AUD-02 | **Automatic capture** of create/update/delete/restore for auditable entities, written in the same tx as the change. |
| FR-AUD-03 | Each row: actor (`user_id`), entity type/id, action, **before/after** (changed cols; full snapshot on delete), `request_id`, `ip`, `occurred_at`; partitioned by `(tenant_id, month)`. |
| FR-AUD-04 | **Impersonation context:** actions during a support session record the **real operator ≠ subject** (UC-AUTH-14). |
| FR-AUD-05 | Lifecycle, membership, role, and **visibility-grant** changes are audited (03/04/05). |
| FR-AUD-06 | **View/search** the trail (`audit:view` cap), tenant-scoped. |
| FR-AUD-07 | Retention **≥ 7y**; audit **survives** tenant suspension/archival. |

## Non-functional / notes
- Capture layer sits at the repository/tx boundary so no handler can bypass it.
- Audit reads are **own-tenant by default** (see open question on parent visibility of audit).

## Open (resolve before 🟢)
- [ ] Can a parent see descendants' audit (e.g. under a `detail` grant), or is audit always own-tenant? (default: own-tenant only)
- [ ] Archival mechanism + timing for partitions beyond the hot window.

## Use cases
See [`use-cases.md`](use-cases.md) — UC-AUD-01 … UC-AUD-05 (each with unit + integration + e2e per `testing.md`).

> With this in place, **02 Authentication** can reach 🟢 Confirmed (its UC-AUTH-14 audit + `support_access_grants` record are now defined).
