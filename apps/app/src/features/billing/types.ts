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

export type PaymentBank = 'BML' | 'MIB' | 'SBI' | 'Other'
export type PaymentStatus = 'Pending verification' | 'Verified' | 'Rejected'

/** The tenant's proof that it paid an invoice by bank transfer; Bool's operators verify it. */
export type PaymentSubmission = {
  id: string
  invoiceId: string
  /** 2dp, in `currency` */
  amount: number
  currency: string
  method: 'Bank transfer'
  /** The bank the money was sent from */
  bank: PaymentBank
  /** The transfer reference the bank printed on the slip */
  reference: string
  /** ISO date */
  paidOn: string
  receipt: { fileName: string; mimeType: string; sizeBytes: number; storageKey: string }
  note?: string
  /** An org person id */
  submittedBy: string
  /** ISO date */
  submittedOn: string
  status: PaymentStatus
  /** An operator id */
  reviewedBy?: string
  reviewedOn?: string
  rejectReason?: string
}

/** Where tenants send transfers. A platform setting, display-only here. */
export type PayeeDetails = {
  accountName: string
  accounts: { bank: string; accountNumber: string; currency: string; swift: string }[]
}
