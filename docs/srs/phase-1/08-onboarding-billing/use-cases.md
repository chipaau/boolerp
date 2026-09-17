# 08 — Onboarding & Billing — Use Cases (Billing)

**Status:** 🟡 In Review. Actors: **Tenant admin** (Control Centre, holds `billing:manage`),
**Tenant member** (`billing:view`), **Operator** (Bool staff, Admin console), **Scheduler** (river job,
system), **Chi**.

Tests per `testing.md`: **Unit** (Go, table-driven) · **Integration** (Testcontainers, real Postgres,
RLS) · **Component** (Vitest, `features/billing/logic.ts` + components) · **E2E** (Playwright).

---

## UC-BIL-01 — Issue an invoice automatically *(Scheduler)*
- **Trigger:** daily job; a tenant has a billing period whose `period_to` < today with no invoice.
- **Preconditions:** active tenant with a subscription.
- **Main flow:**
  1. Job runs per tenant inside `WithTenant`.
  2. Compute lines (FR-BIL-05) and GST (8%, or 0 for government).
  3. In one tx: lock the `INV`/year counter row → increment → insert invoice + lines (`Due`, due +14 days).
  4. Enqueue `billing.invoice_issued` transactionally; audit.
- **Alternate:** invoice for `(tenant_id, period_from)` already exists → no-op, no number consumed. ·
  Catch-up past due date → issued as `Overdue`. · Pending change effective inside period → prorated line;
  change applied to subscription at `effective_on`.
- **Exceptions:** any failure → rollback, number not consumed (no gap); job retries.
- **Postcondition:** exactly one invoice per period, gapless numbers.
- **Tests:** unit — line/GST/proration/rounding tables; integration — concurrent double run issues once,
  rollback leaves no gap, government = 0 GST, cross-tenant isolation; component — `draftInvoice`,
  `invoicesToGenerate`, `nextInvoiceNumber`.

## UC-BIL-02 — Mark invoices overdue *(Scheduler)*
- **Main flow:** daily; `Due` invoices with today > `due_on` → `Overdue`; enqueue `billing.invoice_overdue`
  (mandatory); audit.
- **Alternate:** invoice has a `Pending verification` submission → skipped.
- **Tests:** integration — boundary (due today stays `Due`), pending-submission skip, notification is
  not mutable; component — `issuedStatus`, `invoiceDisplayStatus`.

## UC-BIL-03 — View plan & invoices *(Tenant member)*
- **Main flow:** Control Centre → Billing & plan: plan, cycle, seats used/included, apps, renewal, pending
  change, invoice list (display status incl. "Pending"), invoice detail with lines, billing contact, payee
  bank details. Tenant admin edits the billing contact.
- **Exceptions:** no `billing:view` → 403.
- **Tests:** integration — only own tenant's invoices (RLS); component — `seatState`, display status;
  e2e — page renders fixtures, contact edit.

## UC-BIL-04 — Request a plan change *(Tenant admin)*
- **Main flow:** choose plan + seats + note → `Pending` request; operators notified; audit.
- **Exceptions:** a `Pending` request already exists → 409. · Invalid seats → 422.
- **Tests:** integration — one-pending unique index; e2e — request shows as Pending.

## UC-BIL-05 — Decide a plan change *(Operator)*
- **Main flow:** Admin console → tenant → requests: **approve** → subscription `pending_change` set
  (effective next period boundary) or **decline**; tenant sees the outcome; audit.
- **Exceptions:** request no longer `Pending` → 409.
- **Tests:** integration — approve sets pending change atomically; e2e (admin) — approve/decline.

## UC-BIL-06 — Submit a payment slip *(Tenant admin)*
- **Preconditions:** one or more invoices `Due`/`Overdue` with no pending submission.
- **Main flow:**
  1. Pick invoice(s) (defaults to the oldest payable), enter bank, reference, `paid_on`, amount, note.
  2. Upload receipt (jpg/png/pdf, ≤ 10 MB) → stored at `tenant/{tenant}/receipts/{submission}/{file}`.
  3. One submission per selected invoice, sharing the receipt; status `Pending verification`.
  4. Invoice displays "Pending"; `billing.payment_submitted` to operators; audit.
- **Exceptions:** bad type/size (sniffed) → 422; invoice already `Paid`/`Credited` or pending → 409.
- **Tests:** unit — file validation; integration — multi-invoice shares receipt key, key is tenant-prefixed,
  cross-tenant invoice id rejected (composite FK); component — `payableInvoices`, `receiptStorageKey`,
  `RECEIPT_*`; e2e — pay flow.

## UC-BIL-07 — Verify a payment *(Operator)*
- **Main flow:** Admin console queue of `Pending verification` → open slip → **verify** → submission
  `Verified`, invoice `Paid` (`paid_on` from slip) in one tx; tenant notified; audit.
- **Exceptions:** already reviewed/withdrawn → 409; invoice already has a verified submission → 409.
- **Tests:** integration — atomic update, one-verified unique index; e2e (admin) — verify → tenant sees Paid.

## UC-BIL-08 — Reject a payment *(Operator)*
- **Main flow:** **reject** with a reason (required) → `Rejected`; invoice back to `Due`/`Overdue` by date;
  tenant sees the reason and can upload a new slip (UC-BIL-06); audit.
- **Exceptions:** empty reason → 422.
- **Tests:** integration — status/reason CHECK, overdue recomputed; e2e — reject → re-upload.

## UC-BIL-09 — Withdraw a pending submission *(Tenant admin)*
- **Main flow:** withdraw own `Pending verification` submission → removed from queue; invoice status by date.
- **Exceptions:** already reviewed → 409.
- **Tests:** integration — cannot withdraw reviewed; e2e — withdraw.

## UC-BIL-10 — Billing notifications *(system)*
- **Main flow:** `billing.invoice_issued` (UC-BIL-01), `billing.payment_submitted` (UC-BIL-06, operators),
  `billing.invoice_overdue` (UC-BIL-02, tenant admins, **mandatory**); verify/reject/decision outcomes
  reach the submitter/requester. Enqueued in the same tx as the state change.
- **Tests:** integration — enqueued iff tx commits; overdue cannot be muted in preferences.

---

## ⚠️ Open items
- See `srs.md` "Open" and `DB-BILLING.md` Q1–Q8.
- Admin console billing screens (queue, verify/reject, plan requests) are **not built yet** — only the
  tenant side exists on fixtures.
