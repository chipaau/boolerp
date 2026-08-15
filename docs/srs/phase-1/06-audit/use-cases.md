# 06 — Audit — Use Cases

**Status:** 🟡 In Review. Actors: **Chi** (capture layer), **Tenant admin / Operator** (viewer), **any actor** (audited).

---

## UC-AUD-01 — Auditable write records before/after *(system)*
- **Trigger:** any create/update/delete/restore of an auditable entity. · **Main flow:** the tx-boundary
  capture layer writes an `audit_log` row (changed cols; full snapshot on delete) **in the same transaction**.
- **Exceptions:** if the audit write fails, the whole tx fails (audit is not best-effort). · **Postcondition:** every change has a matching immutable audit row.

## UC-AUD-02 — View / search the audit trail *(Tenant admin / Operator)*
- **Preconditions:** `audit:view` capability. · **Main flow:** filter by actor/entity/action/date within the
  tenant. · **Exceptions:** no cap → denied. · **Postcondition:** trail is inspectable; reads never mutate it.

## UC-AUD-03 — Impersonated action recorded *(system, ties UC-AUTH-14)*
- **Trigger:** an action during an operator support session. · **Main flow:** the audit row records the
  **real operator** as actor + the **subject** being impersonated + the support-grant id. · **Postcondition:** operator ≠ subject is always visible in the trail.

## UC-AUD-04 — Permission / visibility change audited *(system)*
- **Trigger:** a role/capability/membership/visibility-grant change (05/04/03). · **Main flow:** captured with
  before/after. · **Postcondition:** all authority changes are traceable.

## UC-AUD-05 — Audit retained through suspension/archival *(system)*
- **Trigger:** a tenant is suspended/archived. · **Main flow:** its `audit_log` partitions are **retained**
  (≥ 7y), not deleted. · **Postcondition:** history is preserved for compliance.

---

## ⚠️ Open items
- Parent visibility of descendants' audit (default: own-tenant only).
- Archival mechanism + timing.
