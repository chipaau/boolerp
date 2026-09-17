// UI fixtures — approved shapes; replaced at integration
import type { BillingContact, PlanChangeRequest, Subscription, TenantInvoice } from './types'

/** seatsUsed here is a fallback; the hook derives it from people on the books. */
export const SUBSCRIPTION: Subscription = {
  plan: 'Basic',
  cycle: 'Monthly',
  seatsIncluded: 120,
  seatsUsed: 96,
  pricePerSeat: 19,
  currency: 'MVR',
  renewsOn: '2026-10-01',
  apps: ['Control Centre', 'Calendar', 'Inventory'],
}

// Government tenant: GST-exempt, matching the operator console's fixtures (taxRate 0).
export const INVOICES: TenantInvoice[] = [
  {
    id: 'inv-2609', number: 'INV-2026-0914', periodFrom: '2026-09-01', periodTo: '2026-09-30', issuedOn: '2026-09-01', dueOn: '2026-09-15', status: 'Overdue',
    lines: [{ label: 'Basic plan seats', qty: 120, unitAmount: 19 }, { label: 'Extra site pack', qty: 1, unitAmount: 450 }],
    subtotal: 2730, gst: 0, total: 2730, currency: 'MVR',
  },
  {
    id: 'inv-2608', number: 'INV-2026-0811', periodFrom: '2026-08-01', periodTo: '2026-08-31', issuedOn: '2026-08-01', dueOn: '2026-08-15', status: 'Paid',
    lines: [{ label: 'Basic plan seats', qty: 120, unitAmount: 19 }],
    subtotal: 2280, gst: 0, total: 2280, currency: 'MVR', paidOn: '2026-08-12',
  },
  {
    id: 'inv-2607c', number: 'CN-2026-0007', periodFrom: '2026-07-01', periodTo: '2026-07-31', issuedOn: '2026-07-20', dueOn: '2026-07-20', status: 'Credited',
    lines: [{ label: 'Starter to Basic proration credit', qty: 1, unitAmount: -310 }],
    subtotal: -310, gst: 0, total: -310, currency: 'MVR',
  },
  {
    id: 'inv-2607', number: 'INV-2026-0708', periodFrom: '2026-07-01', periodTo: '2026-07-31', issuedOn: '2026-07-01', dueOn: '2026-07-15', status: 'Paid',
    lines: [{ label: 'Starter plan seats', qty: 40, unitAmount: 22 }],
    subtotal: 880, gst: 0, total: 880, currency: 'MVR', paidOn: '2026-07-09',
  },
]

export const CONTACT: BillingContact = {
  name: 'Ibrahim Waheed',
  email: 'finance@malecouncil.gov.mv',
  phone: '3324570',
  address: 'Malé City Council, Ameer Ahmed Magu, Malé 20094',
  tin: 'Exempt — government',
}

export const PLAN_REQUESTS: PlanChangeRequest[] = [
  { id: 'pcr-1', plan: 'Basic', seats: 120, note: 'Moving Inventory to every site.', requestedBy: 'EMP-017', requestedOn: '2026-07-14', status: 'Approved' },
]

/** GST percent on this tenant's invoices: a government council, so exempt. */
export const TENANT_GST_RATE = 0
