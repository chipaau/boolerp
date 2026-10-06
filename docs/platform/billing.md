# Billing

Status: in progress (C171). `billing_agreements` built; the billing contact, invoices,
credits, payments with receipts, Bool's bank accounts, change requests, and overdue
chasing come next, one table at a time.

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

## Next

- The billing contact: name, email, phone, address, and tax number, current only.
- Invoices and their lines, then credit notes and refunds.
- Payments submitted from Control Centre with a receipt, verified or rejected by an
  operator. Receipts need object storage ([storage](storage.md)), decided with this
  first use.
- Bool's bank accounts (a platform setting), change requests, and overdue chasing
  (background work, roadmap step 12).

See [tenancy](tenancy.md), [self-hosting](self-hosting.md), and the
[decision register](../decisions/README.md).
