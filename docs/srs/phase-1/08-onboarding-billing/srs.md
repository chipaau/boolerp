# 08 — Onboarding & Billing — SRS (Billing: invoices & bank-transfer payments)

**Status:** 🟡 In Review &nbsp;·&nbsp; UI built on fixtures (Control Centre → Billing & plan); **backend
not started**. Covers the **recurring billing** slice: subscription, automatic invoices, bank-transfer
payment slips verified by Bool staff, plan change requests. Self-serve website onboarding (UC-ONB-*)
stays in the checklist and is specified separately. Data model: [`DB-BILLING.md`](../../../data-model/DB-BILLING.md)
(🟡 proposed, table-by-table confirmation pending).

**Surfaces — never mixed:** **Control Centre** (`apps/app`, `/api/v1/billing/*`) = the tenant.
**Admin console** (`apps/admin`, `/api/v1/admin/billing/*`) = Bool staff (operators).

## Decisions captured (from the approved shapes + built UI)
- Payment is by **invoice + bank transfer only**. No gateway, **no card or bank-account data stored**.
- The account tenants pay into is a **platform setting**, display-only in Control Centre.
- **Control Centre + Calendar** are always included in a subscription.
- Invoices are **automatic**; nobody drafts them by hand.
- GST **8%** for private tenants; **government** tenants (party type `government`) exempt.
- Terms: **due 14 days** after issue.

## Functional requirements
| ID | Requirement |
|---|---|
| FR-BIL-01 | One subscription per tenant: plan, cycle, `seats_included`, `price_per_seat`, currency (MVR default), `renews_on`, apps (⊇ Control Centre, Calendar), optional `pending_change {plan, seats, effective_on}`. `seats_used` is **derived** (active memberships), never stored. |
| FR-BIL-02 | **Automatic issuing:** a scheduled river job, per tenant via `WithTenant`, issues an invoice for each ended period, on the day after `period_to`. |
| FR-BIL-03 | **Gapless numbering:** the number (`INV-YYYY-nnnn`) is allocated by locking the per-series counter row **in the same transaction** that inserts the invoice. Never a sequence. |
| FR-BIL-04 | **Idempotent:** unique `(tenant_id, period_from)`; a re-run or concurrent run issues nothing twice and consumes no number. |
| FR-BIL-05 | **Lines:** plan seats × `price_per_seat`; extra seats above `seats_included` × price; a **prorated** line when a pending change takes effect inside the period. `subtotal` = Σ lines; `gst` = 8% of subtotal (0 if government); `total` = subtotal + gst; all rounded to 2 dp. |
| FR-BIL-06 | `issued_on` = day after period end; `due_on` = `issued_on` + 14; status `Due`. Issuing an invoice whose due date has already passed (catch-up) sets `Overdue`. |
| FR-BIL-07 | **Overdue sweep:** a daily job moves `Due` → `Overdue` when today > `due_on` — **except** invoices with a submission `Pending verification`. |
| FR-BIL-08 | Tenant views plan, seats (used/included), apps, pending change, invoices (with lines), billing contact and payee bank details. Tenant edits its billing contact. |
| FR-BIL-09 | Tenant **requests a plan change** (plan, seats, note). At most one `Pending` request per tenant. |
| FR-BIL-10 | Operator **approves** (sets the subscription's `pending_change`, effective next period) or **declines** a request. |
| FR-BIL-11 | Tenant **submits a payment slip** for an open invoice (`Due`/`Overdue`): bank (BML/MIB/SBI/Other), reference, `paid_on`, amount, optional note, receipt file **jpg/png/pdf ≤ 10 MB** stored at a tenant-prefixed key. While any submission is `Pending verification` the invoice **displays "Pending"** and is not counted overdue. |
| FR-BIL-12 | **One transfer, several invoices** = one submission per invoice, all sharing the same receipt object. |
| FR-BIL-13 | Operator **verifies** a submission → submission `Verified`, invoice `Paid` with `paid_on` from the slip, atomically. At most one verified submission per invoice. |
| FR-BIL-14 | Operator **rejects** with a mandatory reason → submission `Rejected`; invoice returns to `Due`/`Overdue` by date; tenant may upload a new slip. |
| FR-BIL-15 | Tenant may **withdraw** its own submission while still `Pending verification`. |
| FR-BIL-16 | **Notifications:** `billing.invoice_issued` (tenant billing admins + contact email), `billing.payment_submitted` (operators), `billing.invoice_overdue` (tenant admins — **mandatory, cannot be muted**). |
| FR-BIL-17 | Every state change (issue, overdue, request, decision, submit, verify, reject, withdraw) is **audited** (→ 06). |

## Non-functional / notes
- Tenant isolation: all billing tables RLS-scoped (except the counter); cross-tenant isolation test required.
- Receipt upload validated server-side by content sniffing, not just extension/`Content-Type`.
- Authorization (Cerbos): `billing:view`, `billing:manage` (contact, requests, slips) on the tenant side;
  operator actions only on `/api/v1/admin/*`.
- Money arithmetic in `numeric`, never floats; rounding half-up to 2 dp per line, then summed.

## Open (resolve before 🟢)
- [ ] Data-model questions Q1–Q8 in `DB-BILLING.md`.
- [ ] Unpaid consequences: does `Overdue` ever lead to suspension (04), and after how long?
- [ ] Annual cycle: extra seats billed at renewal, or monthly true-up?
- [ ] Proration basis: calendar days in the period?
- [ ] Downgrade below `seats_used` — blocked at request, or at approval?
- [ ] Who receives `billing.invoice_issued` (billing contact email only, or also Control Centre admins)?

## Use cases
See [`use-cases.md`](use-cases.md) — UC-BIL-01 … UC-BIL-10.
