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
