// UI fixtures — shapes pending SRS/data-model review; replaced at integration.
// Seed data from the Hexa Admin design (.design/login/Hexa Workspace/Hexa Admin.dc.html).
import type { BillingProfile, ChaseTemplate, Credit, DunningPolicy, DunningStep, Invoice, PaymentMethod, TenantDunningMode } from './types'

export const BILLING_PROFILES: Record<string, BillingProfile> = {
  ncit: { contact: 'Ibrahim Waheed', email: 'finance@ncit.gov.mv', phone: '3324570', taxId: 'Exempt — government', taxRate: 0, po: 'PO-2026-114', method: 'Bank transfer' },
  vc: { contact: 'Shaheen Adam', email: 'accounts@villacollege.edu.mv', phone: '3301620', taxId: 'GST 1024-VC', taxRate: 8, po: '—', method: 'Card ending 4417' },
  mtcc: { contact: 'Hassan Latheef', email: 'ap@mtcc.com.mv', phone: '3001240', taxId: 'GST 0088-MTCC', taxRate: 8, po: 'PO-MTCC-9921', method: 'Bank transfer' },
  moh: { contact: 'Aminath Zulfa', email: 'finance@health.gov.mv', phone: '3014460', taxId: 'Exempt — government', taxRate: 0, po: 'PO-MOH-2026-07', method: 'Government voucher' },
  acc: { contact: 'Mohamed Naeem', email: 'finance@adducity.gov.mv', phone: '6885560', taxId: 'Exempt — government', taxRate: 0, po: 'PO-ACC-441', method: 'Bank transfer' },
  dhi: { contact: 'Nasrulla Ali', email: 'ap@dhiraagu.com.mv', phone: '3323400', taxId: 'GST 0012-DHI', taxRate: 8, po: '—', method: 'Card ending 9002' },
  krh: { contact: 'Aminath Zulfa', email: 'finance@health.gov.mv', phone: '3014460', taxId: 'Exempt — government', taxRate: 0, po: 'PO-MOH-2026-07', method: 'Rolled up to MOH' },
  igmh: { contact: 'Not set', email: 'admin@igmh.gov.mv', phone: '3335335', taxId: 'Exempt — government', taxRate: 0, po: '—', method: 'Not set' },
  baec: { contact: 'Not set', email: '—', phone: '—', taxId: 'Exempt — government', taxRate: 0, po: '—', method: 'Not set' },
}

export const DUNNING_STEPS: DunningStep[] = [
  { key: 'r1', label: 'First reminder', note: 'Friendly nudge to the billing contact.' },
  { key: 'r2', label: 'Second reminder', note: 'Copied to the tenant admins.' },
  { key: 'warn', label: 'Suspension warning', note: 'States the date access will stop.' },
  { key: 'susp', label: 'Auto-suspend', note: 'Blocks sign-in until the invoice clears.' },
]

export const DUNNING_POLICY: DunningPolicy = { r1: 3, r2: 7, warn: 14, susp: 30, auto: true }

export const DUNNING_MODES: TenantDunningMode[] = ['Platform policy', 'Reminders only — never suspend', 'Chase early — reminders at +1 and +3', 'No automated chasing']
export const CHASE_TEMPLATES: ChaseTemplate[] = ['Polite nudge', 'Firm reminder', 'Final notice before suspension']
/** Options offered by the billing-details drawer. */
export const PAYMENT_METHODS: PaymentMethod[] = ['Bank transfer', 'Card ending 4417', 'Government voucher', 'Rolled up to parent', 'Not set']
export const PERIODS = ['Oct 2026', 'Sep 2026', 'Aug 2026']

export const CREDITS: Credit[] = [
  { no: 'CN-2026-0012', tenantSlug: 'ncit', against: 'INV-2026-0129', kind: 'Credit note', period: 'Aug 2026', date: '09 Sep 2026', amount: 418, reason: 'Seat count corrected after a mid-month leaver' },
]

export const INVOICES: Invoice[] = [
  { no: 'INV-2026-0148', tenantSlug: 'mtcc', period: 'Sep 2026', issued: '01 Sep 2026', due: '15 Sep 2026', amount: 24420, status: 'Overdue' },
  { no: 'INV-2026-0147', tenantSlug: 'vc', period: 'Sep 2026', issued: '01 Sep 2026', due: '15 Sep 2026', amount: 10852, status: 'Due' },
  { no: 'INV-2026-0146', tenantSlug: 'ncit', period: 'Sep 2026', issued: '01 Sep 2026', due: '15 Sep 2026', amount: 4222, status: 'Paid' },
  { no: 'INV-2026-0145', tenantSlug: 'moh', period: 'Sep 2026', issued: '01 Sep 2026', due: '15 Sep 2026', amount: 22044, status: 'Paid' },
  { no: 'INV-2026-0144', tenantSlug: 'krh', period: 'Sep 2026', issued: '01 Sep 2026', due: '15 Sep 2026', amount: 5229, status: 'Due' },
  { no: 'INV-2026-0143', tenantSlug: 'acc', period: 'Sep 2026', issued: '01 Sep 2026', due: '15 Sep 2026', amount: 4716, status: 'Paid' },
  { no: 'INV-2026-0131', tenantSlug: 'dhi', period: 'Aug 2026', issued: '01 Aug 2026', due: '15 Aug 2026', amount: 8900, status: 'Overdue' },
  { no: 'INV-2026-0130', tenantSlug: 'mtcc', period: 'Aug 2026', issued: '01 Aug 2026', due: '15 Aug 2026', amount: 24420, status: 'Paid' },
  { no: 'INV-2026-0129', tenantSlug: 'ncit', period: 'Aug 2026', issued: '01 Aug 2026', due: '15 Aug 2026', amount: 4184, status: 'Paid' },
  { no: 'INV-2026-0128', tenantSlug: 'vc', period: 'Aug 2026', issued: '01 Aug 2026', due: '15 Aug 2026', amount: 10852, status: 'Paid' },
  { no: 'INV-2026-0127', tenantSlug: 'moh', period: 'Aug 2026', issued: '01 Aug 2026', due: '15 Aug 2026', amount: 21900, status: 'Paid' },
  { no: 'INV-2026-0155', tenantSlug: 'igmh', period: 'Oct 2026', issued: '—', due: '01 Oct 2026', amount: 8900, status: 'Draft' },
]

export const CURRENT_PERIOD = 'Sep 2026'
export const TODAY = '16 Sep 2026'
/** Days in a billing cycle and days left in the current one (proration). */
export const CYCLE_DAYS = 30
export const DAYS_LEFT = 15
export const NEXT_CYCLE_DATE = '1 Oct 2026'
