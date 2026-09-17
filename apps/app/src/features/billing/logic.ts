// Pure billing derivations and presentation maps. No fixtures, no hooks.
import { parseIsoDate } from '@/lib/dates'
import type { InvoiceLine, InvoiceStatus, PlanChangeStatus, PlanName } from './types'

export const PLANS: PlanName[] = ['Starter', 'Basic', 'Pro', 'Enterprise']
/** Per-seat list prices, kept in step with the operator console's plan table. */
export const PLAN_SEAT_PRICE: Record<PlanName, number> = { Starter: 22, Basic: 19, Pro: 16, Enterprise: 12 }
/** Maldives GST, percent. Government tenants are exempt and carry 0 on their invoices. */
export const GST_RATE = 8
/** Apps every tenant has, whatever the plan. */
export const ALWAYS_ON_APPS = ['Control Centre', 'Calendar']

/** 'MVR 2,730.00' */
export const formatMoney = (n: number, currency = 'MVR') =>
  `${currency} ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export const round2 = (n: number) => Math.round(n * 100) / 100
export const lineTotal = (l: InvoiceLine) => round2(l.qty * l.unitAmount)

export type BadgeTone = 'success' | 'warning' | 'risk' | 'neutral' | 'slate'
export const INVOICE_TONE: Record<InvoiceStatus, BadgeTone> = { Draft: 'neutral', Due: 'warning', Overdue: 'risk', Paid: 'success', Credited: 'slate' }
export const REQUEST_TONE: Record<PlanChangeStatus, BadgeTone> = { Pending: 'warning', Approved: 'success', Declined: 'neutral' }

export const isOpenInvoice = (s: InvoiceStatus) => s === 'Due' || s === 'Overdue'

/** Seats at or above 90% of the allowance warn; above it is over. */
export function seatState(used: number, included: number): 'ok' | 'near' | 'over' {
  if (used > included) return 'over'
  return included > 0 && used / included >= 0.9 ? 'near' : 'ok'
}

/** '14 Sep 2026' from an ISO date. */
export function fmtIso(iso: string) {
  return parseIsoDate(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
