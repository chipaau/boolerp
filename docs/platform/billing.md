# Billing

Status: in progress (C171–C173, C181). `billing_agreements`, `invoices`, and `invoice_lines`
built; credits, payments with receipts, Bool's bank accounts, change requests, and overdue
chasing come next, one table at a time. There is no billing contact: invoices use the
tenant's name, email, phone, and `tax_number` (C172).

Billing is a platform capability (`internal/platform/billing`, C122). Bool's operators
manage it from the admin console; a tenant sees its own billing in Control Centre and
pays from there by bank transfer, uploading the receipt for an operator to verify.

## Pricing (C171)

There is no plan catalogue: plans are not public yet and will be designed later. Each
client agrees its own price, billed **monthly or yearly**; two clients with the same
setup may pay differently. No limits are enforced today (no seat or app cap).

## `billing_agreements`

What a tenant has agreed to pay ([data model](../data-model/README.md)). An agreement can
be a flat price per cycle (`recurring_amount`), a price per seat in use
(`per_seat_amount`), or both, plus a one-time `setup_amount`, in an ISO 4217 `currency`,
with its own `tax_rate` (0 when exempt), an optional `seat_limit`, and a
`payer_tenant_id` when another tenant pays (a ministry paying for its hospitals).

- **History:** changing the terms sets `ends_on` (the last day covered) on the current
  agreement and starts a new one the day after, so invoices keep the terms they were
  priced under.
- **No overlaps:** a tenant's agreements never overlap in time, so it has at most one
  open agreement. The database enforces it with an exclusion constraint, which needs
  the `btree_gist` extension ([PostgreSQL](postgres.md)).
- **Money** is exact decimal (`numeric(19,4)`), never floating point.
- **Access:** the operator tenant reads and writes every agreement; a tenant reads its
  own, and a payer the ones it pays for; tenants never write; nothing deletes one.
  Every change is audited (C164).

## `invoices` (C173)

What a tenant is billed for one period under its agreement, with a copy of the agreement's
currency and tax rate, its subtotal, tax, and total, an optional purchase-order reference,
and notes.

- **Lifecycle:** a draft is Bool's to edit; issuing gives it its number (unique, never
  reused) and freezes it. Afterwards only its status moves on: `issued` to `paid` (with
  the payment date) or `void`. A correction is a credit note and a new invoice.
- **Derived, not stored:** "Due" and "Overdue" are an issued invoice before and after its
  due date; "Credited" comes from credit notes.
- **Access:** the operator reads and writes all; a tenant reads its own issued invoices
  (not drafts), and a payer those of the agreements it pays for.

## `invoice_lines` (C181)

What an invoice's subtotal adds up from: each line has a `kind` (`recurring`, `seats`,
`setup`, or `other`), a description, a quantity, a unit amount (negative for a discount),
and its amount (quantity × unit amount). Lines change only while the invoice is a draft,
and issuing checks that the subtotal is their sum.

## Next

- Credit notes and refunds.
- The numbering format, settled with the operation that issues an invoice.
- Payments submitted from Control Centre with a receipt, verified or rejected by an
  operator. Receipts need object storage ([storage](storage.md)), decided with this
  first use.
- Bool's bank accounts (a platform setting), change requests, and overdue chasing
  (background work, roadmap step 12).

See [tenancy](tenancy.md), [self-hosting](self-hosting.md), and the
[decision register](../decisions/README.md).
