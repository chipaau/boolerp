// Pure billing derivations. No fixtures, no hooks.
import type { Plan } from '@/features/tenants/types'
import type { InvoiceStatus, LedgerStatus } from './types'

/** 'MVR 24,420' */
export const formatMvr = (n: number) => 'MVR ' + Math.round(n).toLocaleString('en-US')

export const taxOn = (net: number, rate: number) => Math.round((net * rate) / 100)

export type ToneKey = 'success' | 'warning' | 'neutral' | 'info'
export const ledgerTone = (s: LedgerStatus): ToneKey =>
  s === 'Paid' ? 'success' : s === 'Overdue' ? 'warning' : s === 'Draft' || s === 'Credited' || s === 'Refunded' ? 'neutral' : 'info'

export const isOpen = (s: InvoiceStatus) => s === 'Due' || s === 'Overdue'

/**
 * Plan-change proration from the design: positive = charge added to the current invoice,
 * negative = credit back. `null` when the change takes effect next cycle.
 */
export function prorate(from: Plan, to: Plan, seatsUsed: number, effect: 'Immediately' | 'Next cycle', cycleDays: number, daysLeft: number) {
  const oldMonthly = from.base + from.perSeat * seatsUsed
  const newMonthly = to.base + to.perSeat * seatsUsed
  return { newMonthly, delta: effect === 'Immediately' ? Math.round(((newMonthly - oldMonthly) * daysLeft) / cycleDays) : null }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
/** ISO date or date-time → '15 Sep 2026' (reads the calendar date as written, no timezone shift). */
export const formatIsoDate = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d} ${MONTHS[Number(m) - 1]} ${y}`
}

/** '184 KB', '1.3 MB' */
export const formatBytes = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`)
