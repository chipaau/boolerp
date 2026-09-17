// Billing shapes from the Hexa Admin design. Pending SRS/data-model review.
// Money is whole MVR (number). Dates and periods are display strings ('15 Sep 2026', 'Sep 2026').
export type { Undo } from '@/features/tenants/types'

export type InvoiceStatus = 'Draft' | 'Due' | 'Overdue' | 'Paid'

export type Invoice = {
  no: string
  tenantSlug: string
  period: string
  /** '—' while Draft. */
  issued: string
  due: string
  /** Net amount before GST, MVR. */
  amount: number
  status: InvoiceStatus
}

export type CreditKind = 'Credit note' | 'Refund'

export type Credit = {
  no: string
  tenantSlug: string
  /** Invoice number it is issued against. */
  against: string
  kind: CreditKind
  period: string
  date: string
  amount: number
  reason: string
}

export type PaymentMethod = 'Bank transfer' | 'Card ending 4417' | 'Card ending 9002' | 'Government voucher' | 'Rolled up to MOH' | 'Rolled up to parent' | 'Not set'

export type BillingProfile = {
  contact: string
  email: string
  phone: string
  taxId: string
  /** GST percent: 0 (exempt) or 8. */
  taxRate: 0 | 8
  po: string
  method: PaymentMethod
}

export type DunningStepKey = 'r1' | 'r2' | 'warn' | 'susp'
export type DunningStep = { key: DunningStepKey; label: string; note: string }
/** Platform-wide policy: day offsets after due date per step, and whether auto-suspend runs. */
export type DunningPolicy = Record<DunningStepKey, number> & { auto: boolean }

export type TenantDunningMode =
  | 'Platform policy'
  | 'Reminders only — never suspend'
  | 'Chase early — reminders at +1 and +3'
  | 'No automated chasing'

export type ChaseTemplate = 'Polite nudge' | 'Firm reminder' | 'Final notice before suspension'

export type LedgerKind = 'Invoice' | CreditKind
export type LedgerStatus = InvoiceStatus | 'Credited' | 'Refunded'

/** One ledger line: an invoice or a credit/refund (negative net/total). */
export type LedgerLine = {
  kind: LedgerKind
  no: string
  tenantSlug: string
  period: string
  /** Due date for invoices, issue date for credits. */
  due: string
  issued: string
  net: number
  tax: number
  total: number
  status: LedgerStatus
  /** Tenant payment method for invoices; 'Against INV-…' for credits. */
  method: string
  po: string
  /** Invoices only: sum of credits/refunds issued against it. */
  credited: number
  /** Credits only. */
  against: string | null
  reason: string | null
}

export type BillingSummary = {
  /** Due + Overdue invoice totals minus credits against them. */
  outstanding: number
  openCount: number
  overdueTotal: number
  overdueCount: number
  /** Paid invoice totals for the current period (Sep 2026). */
  collected: number
  collectedPeriod: string
  creditedTotal: number
  /** Monthly base + perSeat × seats in use across active tenants. */
  runRate: number
  /** Invoices not Paid (the Billing nav hint). */
  unpaidCount: number
}

export type EstimateLine = { label: string; value: number | null; strong?: boolean }

export type TenantBilling = {
  profile: BillingProfile
  /** False when the billing contact is 'Not set' (invoices fall back to the tenant e-mail). */
  contactSet: boolean
  dunningMode: TenantDunningMode
  /** Estimated next invoice: base, seats, GST (null when exempt), total. */
  estimate: { base: number; seatCharge: number; seatsUsed: number; perSeat: number; net: number; tax: number; total: number; lines: EstimateLine[] }
  ledger: LedgerLine[]
  openCount: number
  openTotal: number
  hasOverdue: boolean
  /** Parent tenants only (has children). */
  group: { enabled: boolean; lines: { slug: string; name: string; detail: string; value: number }[]; total: number } | null
}

export type IssueCreditInput = { tenantSlug: string; against: string; kind: CreditKind; amount: number; reason: string }
