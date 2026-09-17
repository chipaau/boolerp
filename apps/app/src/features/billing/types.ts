// The tenant's own view of its subscription. Approved shapes; they mirror the API.
// No card or bank-account data lives here: payment is by invoice and bank transfer.

export type PlanName = 'Starter' | 'Basic' | 'Pro' | 'Enterprise'
export type BillingCycle = 'Monthly' | 'Annual'

export type Subscription = {
  plan: PlanName
  cycle: BillingCycle
  seatsIncluded: number
  seatsUsed: number
  /** 2dp, in `currency` */
  pricePerSeat: number
  /** 3-letter code, 'MVR' */
  currency: string
  /** ISO date */
  renewsOn: string
  /** Always includes 'Control Centre' and 'Calendar'. */
  apps: string[]
  pendingChange?: { plan: PlanName; seats: number; effectiveOn: string }
}

export type InvoiceStatus = 'Draft' | 'Due' | 'Overdue' | 'Paid' | 'Credited'
export type InvoiceLine = { label: string; qty: number; unitAmount: number }

export type TenantInvoice = {
  id: string
  number: string
  periodFrom: string
  periodTo: string
  issuedOn: string
  dueOn: string
  status: InvoiceStatus
  lines: InvoiceLine[]
  subtotal: number
  gst: number
  total: number
  currency: string
  paidOn?: string
}

export type BillingContact = { name: string; email: string; phone: string; address: string; tin: string }

export type PlanChangeStatus = 'Pending' | 'Approved' | 'Declined'
export type PlanChangeRequest = {
  id: string
  plan: PlanName
  seats: number
  note: string
  /** An org person id, e.g. 'EMP-017' */
  requestedBy: string
  requestedOn: string
  status: PlanChangeStatus
}
