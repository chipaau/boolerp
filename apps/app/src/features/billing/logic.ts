// Pure billing derivations and presentation maps. No fixtures, no hooks.
import { parseIsoDate } from '@/lib/dates'
import type { InvoiceLine, InvoiceStatus, PlanChangeStatus, PlanName, Subscription, TenantInvoice } from './types'

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

// ── Automatic invoicing ──────────────────────────────────────────────────────────────────────
// Pure: the fixture hook runs these on load; in production a scheduled API job does the same,
// issuing each invoice in the transaction that takes its number from the gapless counter.

export type BillingPeriod = { from: string; to: string }

/** Days a new invoice has before it falls due. */
export const INVOICE_TERMS_DAYS = 14
const DAY = 86_400_000
const utc = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10)
/** ISO date plus whole days. */
export const addDays = (d: string, n: number) => iso(utc(d) + n * DAY)
/** ISO date plus whole months, clamping the day to the target month's end. */
export function addMonths(d: string, n: number) {
  const [y, m, day] = d.split('-').map(Number)
  const first = new Date(Date.UTC(y, m - 1 + n, 1))
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate()
  return iso(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), Math.min(day, last)))
}
const cycleMonths = (s: Pick<Subscription, 'cycle'>) => (s.cycle === 'Annual' ? 12 : 1)

/**
 * Billing periods anchored on the renewal date, from `back` cycles before today's period to
 * `ahead` cycles after it. Oldest first; the period holding `today` is in the middle.
 */
export function billingPeriods(s: Pick<Subscription, 'cycle' | 'renewsOn'>, today: string, back = 12, ahead = 1): BillingPeriod[] {
  const step = cycleMonths(s)
  // k = cycles from the renewal date to the period containing today
  let k = Math.floor(((Number(today.slice(0, 4)) - Number(s.renewsOn.slice(0, 4))) * 12 + Number(today.slice(5, 7)) - Number(s.renewsOn.slice(5, 7))) / step)
  while (addMonths(s.renewsOn, k * step) > today) k--
  while (addMonths(s.renewsOn, (k + 1) * step) <= today) k++
  const out: BillingPeriod[] = []
  for (let i = k - back; i <= k + ahead; i++) out.push({ from: addMonths(s.renewsOn, i * step), to: addDays(addMonths(s.renewsOn, (i + 1) * step), -1) })
  return out
}

/** Next number in the year's INV series, continuing the highest one on record: INV-2026-0915. */
export function nextInvoiceNumber(existing: Pick<TenantInvoice, 'number'>[], year: string) {
  const re = new RegExp(`^INV-${year}-(\\d+)$`)
  const max = existing.reduce((n, i) => Math.max(n, Number(re.exec(i.number)?.[1] ?? 0)), 0)
  return `INV-${year}-${String(max + 1).padStart(4, '0')}`
}

/** 'Due' until the due date has passed, then 'Overdue'. */
export const issuedStatus = (dueOn: string, today: string): InvoiceStatus => (today > dueOn ? 'Overdue' : 'Due')

/**
 * The invoice a period will carry: plan seats, extra seats above the allowance, and a prorated
 * line when a pending plan change takes effect inside the period. Issued the day after the
 * period ends, due 14 days later. `gstRate` is a percent (0 for government tenants).
 */
export function draftInvoice(s: Subscription, period: BillingPeriod, seatsUsed: number, gstRate: number, existing: Pick<TenantInvoice, 'number'>[] = []): TenantInvoice {
  const months = cycleMonths(s)
  const unit = round2(s.pricePerSeat * months)
  const span = months === 12 ? ' (12 months)' : ''
  const lines: InvoiceLine[] = [{ label: `${s.plan} plan seats${span}`, qty: s.seatsIncluded, unitAmount: unit }]
  if (seatsUsed > s.seatsIncluded) lines.push({ label: `Extra seats above ${s.seatsIncluded}${span}`, qty: seatsUsed - s.seatsIncluded, unitAmount: unit })
  const change = s.pendingChange
  if (change && change.effectiveOn >= period.from && change.effectiveOn <= period.to) {
    const days = (utc(period.to) - utc(period.from)) / DAY + 1
    const left = (utc(period.to) - utc(change.effectiveOn)) / DAY + 1
    const delta = (change.seats * PLAN_SEAT_PRICE[change.plan] - s.seatsIncluded * s.pricePerSeat) * months
    lines.push({ label: `${change.plan} with ${change.seats} seats from ${change.effectiveOn} (prorated ${left}/${days} days)`, qty: 1, unitAmount: round2((delta * left) / days) })
  }
  const subtotal = round2(lines.reduce((n, l) => n + lineTotal(l), 0))
  const gst = round2((subtotal * gstRate) / 100)
  const issuedOn = addDays(period.to, 1)
  return {
    id: `inv-${period.from}`,
    number: nextInvoiceNumber(existing, issuedOn.slice(0, 4)),
    periodFrom: period.from,
    periodTo: period.to,
    issuedOn,
    dueOn: addDays(issuedOn, INVOICE_TERMS_DAYS),
    status: 'Draft',
    lines,
    subtotal,
    gst,
    total: round2(subtotal + gst),
    currency: s.currency,
  }
}

/**
 * Invoices owed but not yet issued: every period that has ended after the latest invoiced one
 * (credit notes aside), numbered in sequence. Never backfills before the first invoice on record,
 * never duplicates a period, so running it twice issues nothing new.
 */
export function invoicesToGenerate(existing: TenantInvoice[], s: Subscription, today: string, gstRate = 0): TenantInvoice[] {
  const billed = existing.filter((i) => i.number.startsWith('INV-'))
  const covered = new Set(billed.map((i) => i.periodFrom))
  const lastTo = billed.reduce<string | null>((m, i) => (m === null || i.periodTo > m ? i.periodTo : m), null)
  const ended = billingPeriods(s, today, 24, 0).filter((p) => p.to < today && !covered.has(p.from))
  const due = lastTo === null ? ended.slice(-1) : ended.filter((p) => p.from > lastTo)
  const out: TenantInvoice[] = []
  for (const p of due) {
    const inv = draftInvoice(s, p, s.seatsUsed, gstRate, [...existing, ...out])
    out.push({ ...inv, status: issuedStatus(inv.dueOn, today) })
  }
  return out
}

/** Audit wording for an automatic issue; the badge reads it back. */
export const autoIssuedText = (number: string) => `Invoice ${number} issued automatically`
/** Invoice numbers the audit says were issued automatically. */
export const autoIssuedNumbers = (texts: string[]) => new Set(texts.flatMap((t) => /^Invoice (\S+) issued automatically$/.exec(t)?.[1] ?? []))
