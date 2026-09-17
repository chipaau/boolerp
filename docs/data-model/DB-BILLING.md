# DB — Billing (08: subscriptions, invoices, bank-transfer payments)

> **Status: 🟡 Proposed — pending table-by-table confirmation.** The *shapes* (Subscription,
> TenantInvoice, BillingContact, PlanChangeRequest, PaymentSubmission) were approved by the user and
> already back the Control Centre fixture UI (`apps/app/src/features/billing/types.ts`). The **DDL below
> is not approved**: each table needs an explicit yes before any migration, sqlc query or seed exists.
> Two tables — **`tenant_invoice_lines`** and **`invoice_number_counters`** — are implementation tables
> that are **not** in the approved shape list and need their own explicit approval (alternatives noted).

Pooled + RLS, grain `tenant_id`. Conventions: UUID v7 PKs, `timestamptz` times, `date` for calendar
facts, money `numeric(14,2)` + `currency char(3)` FK `currencies(code)`. See `.claude/rules/tenancy.md`
+ `conventions.md`. **No card or bank-account data is stored anywhere** — payment is by invoice and
bank transfer; the account tenants pay into is a platform setting (display only, not a table here).

## Access model (applies to every tenant-scoped table below)

- **Tenant side (Control Centre, `/api/v1/...`):** via `WithTenant`; `FORCE ROW LEVEL SECURITY` + the
  standard visible-set policy (`USING tenant_id = ANY(app.visible_tenants)`, `WITH CHECK tenant_id =
  app.current_tenant`). `tenant_id` defaults from `app.current_tenant`. Parent aggregation does **not**
  apply to billing — `modules[]` in visibility grants never includes billing (confirm).
- **Operator side (Admin console, `/api/v1/admin/*`, Bool staff):** the operator selects a tenant, and the
  handler runs `WithTenant(ctx, selectedTenant, fn)` — the same RLS path, no bypass role. Cross-tenant
  queues (e.g. "all payments pending verification") iterate tenants or read a narrow SECURITY DEFINER
  view restricted to the admin route group — **decide which** (open question Q3).
- **Composite FKs** `(tenant_id, id)` on every parent referenced by a child, so a row can never point at
  another tenant's row.
- Tenant writes are limited by Cerbos to: billing contact, plan change requests (create), payment
  submissions (create / withdraw). Everything else is written by the system job or an operator.

---

## Enums (as `text` + CHECK, matching foundation style)

| Enum | Values |
|---|---|
| plan | `Starter` · `Basic` · `Pro` · `Enterprise` |
| billing cycle | `Monthly` · `Annual` |
| invoice status | `Draft` · `Due` · `Overdue` · `Paid` · `Credited` |
| plan change status | `Pending` · `Approved` · `Declined` |
| payment method | `Bank transfer` (only value in P1) |
| payment bank | `BML` · `MIB` · `SBI` · `Other` |
| payment status | `Pending verification` · `Verified` · `Rejected` |

> Stored as display strings to match the approved shapes. Alternative: lower-snake codes
> (`pending_verification`) with labels in the UI — **confirm** (Q1).

---

### `subscriptions` — 🟡 proposed
One live subscription per tenant. `seats_used` is **derived, not stored** (count of active
`tenant_users` members at read time).

```sql
CREATE TABLE subscriptions (
  id              uuid          PRIMARY KEY DEFAULT uuidv7(),
  tenant_id       uuid          NOT NULL REFERENCES tenants(id) DEFAULT current_setting('app.current_tenant')::uuid,
  plan            text          NOT NULL,
  cycle           text          NOT NULL,
  seats_included  integer       NOT NULL,
  price_per_seat  numeric(14,2) NOT NULL,                        -- per seat per cycle, in currency
  currency        char(3)       NOT NULL DEFAULT 'MVR' REFERENCES currencies(code),
  renews_on       date          NOT NULL,                        -- next period boundary
  apps            text[]        NOT NULL DEFAULT '{control-centre,calendar}',  -- apps.code values; always ⊇ control-centre, calendar
  pending_plan          text,                                    -- pending_change.plan
  pending_seats         integer,                                 -- pending_change.seats
  pending_effective_on  date,                                    -- pending_change.effective_on
  created_at      timestamptz   NOT NULL DEFAULT now(),
  updated_at      timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT uq_subscriptions_tenant        UNIQUE (tenant_id),
  CONSTRAINT uq_subscriptions_tenant_id     UNIQUE (tenant_id, id),
  CONSTRAINT chk_subscriptions_plan         CHECK (plan IN ('Starter','Basic','Pro','Enterprise')),
  CONSTRAINT chk_subscriptions_cycle        CHECK (cycle IN ('Monthly','Annual')),
  CONSTRAINT chk_subscriptions_seats        CHECK (seats_included >= 1),
  CONSTRAINT chk_subscriptions_price        CHECK (price_per_seat >= 0),
  CONSTRAINT chk_subscriptions_core_apps    CHECK (apps @> '{control-centre,calendar}'),
  CONSTRAINT chk_subscriptions_pending_all  CHECK (num_nulls(pending_plan, pending_seats, pending_effective_on) IN (0,3)),
  CONSTRAINT chk_subscriptions_pending_plan CHECK (pending_plan IS NULL OR pending_plan IN ('Starter','Basic','Pro','Enterprise')),
  CONSTRAINT chk_subscriptions_pending_seat CHECK (pending_seats IS NULL OR pending_seats >= 1)
);
```

> `pending_change` flattened to three all-or-nothing columns rather than `jsonb`, so it is typed and
> CHECKed. `apps` as `text[]` of `apps.code` (approved shape) — arrays can't FK; app-validated. Overlaps
> `tenant_apps` (05): **confirm which is the source of truth** (Q2).

### `billing_contacts` — 🟡 proposed
Who receives invoices. One per tenant.

```sql
CREATE TABLE billing_contacts (
  id          uuid        PRIMARY KEY DEFAULT uuidv7(),
  tenant_id   uuid        NOT NULL REFERENCES tenants(id) DEFAULT current_setting('app.current_tenant')::uuid,
  name        text        NOT NULL,
  email       text        NOT NULL,
  phone       text        NOT NULL,
  address     text        NOT NULL,     -- free text as printed on the invoice
  tin         text        NOT NULL,     -- MIRA taxpayer identification number; '' allowed for exempt bodies? (Q6)
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_billing_contacts_tenant UNIQUE (tenant_id)
);
```

### `tenant_invoices` — 🟡 proposed
Invoices **Bool issues to a tenant** (not the tenant's own sales invoices). Written only by the issuing
job and operators; the tenant reads.

```sql
CREATE TABLE tenant_invoices (
  id           uuid          PRIMARY KEY DEFAULT uuidv7(),
  tenant_id    uuid          NOT NULL REFERENCES tenants(id) DEFAULT current_setting('app.current_tenant')::uuid,
  number       text          NOT NULL,                  -- 'INV-2026-0915'; allocated from invoice_number_counters in the issuing tx
  period_from  date          NOT NULL,
  period_to    date          NOT NULL,
  issued_on    date          NOT NULL,                  -- day after period_to
  due_on       date          NOT NULL,                  -- issued_on + 14
  status       text          NOT NULL,
  subtotal     numeric(14,2) NOT NULL,
  gst          numeric(14,2) NOT NULL,                  -- 8% of subtotal for private tenants; 0 for government
  total        numeric(14,2) NOT NULL,
  currency     char(3)       NOT NULL DEFAULT 'MVR' REFERENCES currencies(code),
  paid_on      date,
  created_at   timestamptz   NOT NULL DEFAULT now(),
  updated_at   timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT uq_tenant_invoices_number   UNIQUE (number),                 -- series is platform-wide (Q4)
  CONSTRAINT uq_tenant_invoices_period   UNIQUE (tenant_id, period_from), -- issuing idempotency
  CONSTRAINT uq_tenant_invoices_tenant_id UNIQUE (tenant_id, id),
  CONSTRAINT chk_tenant_invoices_status  CHECK (status IN ('Draft','Due','Overdue','Paid','Credited')),
  CONSTRAINT chk_tenant_invoices_period  CHECK (period_to >= period_from),
  CONSTRAINT chk_tenant_invoices_due     CHECK (due_on >= issued_on),
  CONSTRAINT chk_tenant_invoices_total   CHECK (total = subtotal + gst AND subtotal >= 0 AND gst >= 0),
  CONSTRAINT chk_tenant_invoices_paid    CHECK ((status = 'Paid') = (paid_on IS NOT NULL))
);
CREATE INDEX ON tenant_invoices (status, due_on);   -- overdue sweep
```

> No `Pending` status: "Pending" is a **display** state derived from an open invoice having a
> `Pending verification` submission (FR-BIL-11). Invoices are immutable after issue except
> `status`/`paid_on`; a correction is a `Credited` status + a new invoice.

### `tenant_invoice_lines` — ⚠️ needs explicit approval (not in the approved shape list)
The approved shape has `lines [{label, qty, unit_amount}]`. A child table is proposed so lines are
typed and summable in SQL. **Alternative:** `lines jsonb NOT NULL` on `tenant_invoices` (no new table;
lines are write-once and only ever read with their invoice). Pick one.

```sql
CREATE TABLE tenant_invoice_lines (
  id           uuid          PRIMARY KEY DEFAULT uuidv7(),
  tenant_id    uuid          NOT NULL DEFAULT current_setting('app.current_tenant')::uuid,
  invoice_id   uuid          NOT NULL,
  position     smallint      NOT NULL,                  -- display order
  label        text          NOT NULL,                  -- 'Pro plan — 25 seats', 'Extra seats', 'Prorated change to Enterprise'
  qty          numeric(14,2) NOT NULL,                  -- fractional for proration
  unit_amount  numeric(14,2) NOT NULL,                  -- may be negative for a credit line
  CONSTRAINT fk_invoice_lines_invoice FOREIGN KEY (tenant_id, invoice_id) REFERENCES tenant_invoices (tenant_id, id),
  CONSTRAINT uq_invoice_lines_position UNIQUE (invoice_id, position)
);
```

### `invoice_number_counters` — ⚠️ needs explicit approval (not in the approved shape list)
The gapless per-series counter row required by `tenancy.md` (never a sequence). **Platform
control-plane, not RLS-scoped** — Bool is the issuer, so the series is shared across tenants.

```sql
CREATE TABLE invoice_number_counters (
  series      text        NOT NULL,          -- 'INV'
  year        smallint    NOT NULL,          -- series resets yearly: INV-2026-0001
  last_value  integer     NOT NULL DEFAULT 0,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (series, year),
  CONSTRAINT chk_invoice_counters_value CHECK (last_value >= 0)
);
-- Allocation (inside the issuing tx): INSERT ... ON CONFLICT DO NOTHING; then
-- UPDATE invoice_number_counters SET last_value = last_value + 1 WHERE series=$1 AND year=$2 RETURNING last_value;
-- the row lock serialises issuers; a rollback releases the number, so there is no gap.
```

> If a later platform-wide "document series" table is approved, this folds into it — don't build both.

### `plan_change_requests` — 🟡 proposed

```sql
CREATE TABLE plan_change_requests (
  id            uuid        PRIMARY KEY DEFAULT uuidv7(),
  tenant_id     uuid        NOT NULL REFERENCES tenants(id) DEFAULT current_setting('app.current_tenant')::uuid,
  plan          text        NOT NULL,
  seats         integer     NOT NULL,
  note          text        NOT NULL DEFAULT '',
  requested_by  uuid        NOT NULL REFERENCES users(id),     -- the tenant member ("person") who asked
  requested_on  date        NOT NULL DEFAULT current_date,
  status        text        NOT NULL DEFAULT 'Pending',
  decided_by    uuid        REFERENCES users(id),              -- operator — ⚠️ not in approved shape (Q5)
  decided_at    timestamptz,                                   -- ⚠️ not in approved shape (Q5)
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_plan_change_plan   CHECK (plan IN ('Starter','Basic','Pro','Enterprise')),
  CONSTRAINT chk_plan_change_seats  CHECK (seats >= 1),
  CONSTRAINT chk_plan_change_status CHECK (status IN ('Pending','Approved','Declined')),
  CONSTRAINT chk_plan_change_decided CHECK ((status = 'Pending') = (decided_by IS NULL))
);
CREATE UNIQUE INDEX uq_plan_change_one_pending ON plan_change_requests (tenant_id) WHERE status = 'Pending';
```

### `payment_submissions` — 🟡 proposed
The tenant's proof it paid one invoice by bank transfer. One transfer covering several invoices = one
row **per invoice**, all sharing the same `receipt_storage_key`.

```sql
CREATE TABLE payment_submissions (
  id                  uuid          PRIMARY KEY DEFAULT uuidv7(),
  tenant_id           uuid          NOT NULL DEFAULT current_setting('app.current_tenant')::uuid,
  invoice_id          uuid          NOT NULL,
  amount              numeric(14,2) NOT NULL,
  currency            char(3)       NOT NULL DEFAULT 'MVR' REFERENCES currencies(code),
  method              text          NOT NULL DEFAULT 'Bank transfer',
  bank                text          NOT NULL,
  reference           text          NOT NULL,              -- transfer reference printed on the slip
  paid_on             date          NOT NULL,              -- transfer date per the slip
  receipt_file_name   text          NOT NULL,
  receipt_mime_type   text          NOT NULL,
  receipt_size_bytes  bigint        NOT NULL,
  receipt_storage_key text          NOT NULL,              -- 'tenant/{tenant}/receipts/{submission}/{file}' — tenant-prefixed
  note                text,
  submitted_by        uuid          NOT NULL REFERENCES users(id),
  submitted_on        date          NOT NULL DEFAULT current_date,
  status              text          NOT NULL DEFAULT 'Pending verification',
  reviewed_by         uuid          REFERENCES users(id),  -- operator (Bool staff)
  reviewed_on         date,
  reject_reason       text,
  withdrawn_at        timestamptz,                         -- ⚠️ not in approved shape — needed for UC-BIL-09 (Q7)
  created_at          timestamptz   NOT NULL DEFAULT now(),
  updated_at          timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT fk_payment_submissions_invoice FOREIGN KEY (tenant_id, invoice_id) REFERENCES tenant_invoices (tenant_id, id),
  CONSTRAINT chk_payment_method   CHECK (method = 'Bank transfer'),
  CONSTRAINT chk_payment_bank     CHECK (bank IN ('BML','MIB','SBI','Other')),
  CONSTRAINT chk_payment_status   CHECK (status IN ('Pending verification','Verified','Rejected')),
  CONSTRAINT chk_payment_amount   CHECK (amount > 0),
  CONSTRAINT chk_payment_mime     CHECK (receipt_mime_type IN ('image/jpeg','image/png','application/pdf')),
  CONSTRAINT chk_payment_size     CHECK (receipt_size_bytes BETWEEN 1 AND 10485760),
  CONSTRAINT chk_payment_key      CHECK (receipt_storage_key LIKE 'tenant/' || tenant_id::text || '/%'),
  CONSTRAINT chk_payment_reviewed CHECK ((status = 'Pending verification') = (reviewed_by IS NULL)),
  CONSTRAINT chk_payment_reject   CHECK ((status = 'Rejected') = (reject_reason IS NOT NULL))
);
CREATE INDEX ON payment_submissions (tenant_id, invoice_id);
CREATE INDEX ON payment_submissions (status) WHERE status = 'Pending verification';   -- operator queue
CREATE UNIQUE INDEX uq_payment_one_verified ON payment_submissions (invoice_id) WHERE status = 'Verified';
```

> `receipt` flattened to four columns (typed + CHECKed) instead of `jsonb`. The object itself lives in
> tenant-prefixed object storage; deleting a withdrawn submission's file is a storage concern, not a row
> delete (soft-withdraw keeps the audit trail).

---

## Decisions (2026-09-17)
- **Q1 → snake codes.** Enums are stored as clear snake_case codes (`pending_verification`, `overdue`, …); the UI maps them to display text ("Pending", "Overdue").
- **Q2 → `tenant_apps` is authoritative** for which apps a tenant has; drop `subscriptions.apps` from the proposal (the billing page reads `tenant_apps`).
- **Q4 → one Bool-wide yearly series** `INV-YYYY-nnnn`, Bool as issuer (a single counter row per year in `invoice_number_counters`).
- **Overdue never suspends automatically.** An overdue invoice notifies the platform admins (`billing.invoice_overdue`, mandatory); suspension stays a manual operator action.

## Open questions (resolve before any migration)
- **Q3** Operator cross-tenant queue: iterate `WithTenant` per tenant, or a SECURITY DEFINER view gated to `/api/v1/admin/*`?
- **Q5** Add `decided_by`/`decided_at` to `plan_change_requests` (not in approved shape; audit_log could cover it instead).
- **Q6** `tin` mandatory for government tenants?
- **Q7** Withdrawal: `withdrawn_at` column, a 4th status `Withdrawn`, or hard delete of a still-pending row?
- **Q8** `tenant_invoice_lines` table vs `lines jsonb`; `invoice_number_counters` approval.
