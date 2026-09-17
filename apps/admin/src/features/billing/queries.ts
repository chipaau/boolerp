// The billing data seam. Fixture-backed (no billing API yet). Mutations update the cache in place
// and return an undo so toasts can offer one; at integration they call the API then invalidate.
import { queryOptions, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import { monthlyNet, planByName } from '@/features/tenants/logic'
import { useCurrentUser } from '@/components/layout/user-context'
import { useAdminUsers } from '@/features/admin-users/queries'
import { usePlans, useTenantDirectory } from '@/features/tenants/queries'
import type { DirectoryTenant } from '@/features/tenants/types'
import { taxOn } from './logic'
import * as mock from './mock'
import type {
  BillingProfile,
  BillingSummary,
  Credit,
  DunningPolicy,
  DunningStepKey,
  Invoice,
  IssueCreditInput,
  LedgerLine,
  PaymentSubmission,
  TenantBilling,
  TenantDunningMode,
  Undo,
} from './types'

const NO_MODES: Record<string, TenantDunningMode> = {}
const NO_GROUPS: Record<string, boolean> = {}

const key = (...parts: string[]) => ['admin', 'billing', ...parts] as const

const fixture = <T>(k: readonly string[], data: T) =>
  queryOptions({ queryKey: k, queryFn: async () => data, initialData: data, staleTime: Infinity })

export const invoicesQuery = () => fixture(key('invoices'), mock.INVOICES)
export const creditsQuery = () => fixture(key('credits'), mock.CREDITS)
export const billingProfilesQuery = () => fixture(key('profiles'), mock.BILLING_PROFILES)
export const dunningPolicyQuery = () => fixture(key('dunning'), mock.DUNNING_POLICY)
export const tenantDunningQuery = () => fixture<Record<string, TenantDunningMode>>(key('tenant-dunning'), {})
export const groupBillingQuery = () => fixture<Record<string, boolean>>(key('group'), {})

export const useInvoices = () => useQuery(invoicesQuery()).data ?? mock.INVOICES
export const useCredits = () => useQuery(creditsQuery()).data ?? mock.CREDITS
export const useDunningPolicy = () => useQuery(dunningPolicyQuery()).data ?? mock.DUNNING_POLICY
/** Static option lists and design constants. */
export const useBillingOptions = () => ({
  dunningSteps: mock.DUNNING_STEPS,
  dunningModes: mock.DUNNING_MODES,
  chaseTemplates: mock.CHASE_TEMPLATES,
  paymentMethods: mock.PAYMENT_METHODS,
  periods: mock.PERIODS,
  currentPeriod: mock.CURRENT_PERIOD,
  cycleDays: mock.CYCLE_DAYS,
  daysLeft: mock.DAYS_LEFT,
  nextCycleDate: mock.NEXT_CYCLE_DATE,
})

function fallbackProfile(t: DirectoryTenant | undefined): BillingProfile {
  return { contact: 'Not set', email: t?.email ?? '—', phone: t?.contact ?? '—', taxId: 'Not registered', taxRate: 0, po: '—', method: 'Not set' }
}

/** Billing profile for every tenant in the directory (fallback when none stored), keyed by slug. */
export function useBillingProfiles(): Partial<Record<string, BillingProfile>> {
  const stored = useQuery(billingProfilesQuery()).data ?? mock.BILLING_PROFILES
  const { tenants } = useTenantDirectory()
  return useMemo(() => {
    const out: Partial<Record<string, BillingProfile>> = {}
    for (const t of tenants) out[t.slug] = stored[t.slug] ?? fallbackProfile(t)
    for (const [slug, p] of Object.entries(stored)) if (!(slug in out)) out[slug] = p
    return out
  }, [stored, tenants])
}

export const useBillingProfile = (slug: string): BillingProfile => useBillingProfiles()[slug] ?? fallbackProfile(undefined)

/** Invoices + credits as one ledger (invoices first, then credits), with GST and credited amounts. */
export function useLedger(): LedgerLine[] {
  const invoices = useInvoices()
  const credits = useCredits()
  const profiles = useBillingProfiles()
  return useMemo(() => {
    const creditedAgainst = (no: string) => credits.filter((c) => c.against === no).reduce((n, c) => n + c.amount, 0)
    const inv: LedgerLine[] = invoices.map((i) => {
      const p = profiles[i.tenantSlug] ?? fallbackProfile(undefined)
      const tax = taxOn(i.amount, p.taxRate)
      return {
        kind: 'Invoice', no: i.no, tenantSlug: i.tenantSlug, period: i.period, due: i.due, issued: i.issued,
        net: i.amount, tax, total: i.amount + tax, status: i.status, method: p.method, po: p.po,
        credited: creditedAgainst(i.no), against: null, reason: null,
      }
    })
    const cr: LedgerLine[] = credits.map((c) => ({
      kind: c.kind, no: c.no, tenantSlug: c.tenantSlug, period: c.period, due: c.date, issued: c.date,
      net: -c.amount, tax: 0, total: -c.amount, status: c.kind === 'Refund' ? 'Refunded' : 'Credited',
      method: 'Against ' + c.against, po: '—', credited: 0, against: c.against, reason: c.reason,
    }))
    return [...inv, ...cr]
  }, [invoices, credits, profiles])
}

export function useBillingSummary(): BillingSummary {
  const ledger = useLedger()
  const credits = useCredits()
  const invoices = useInvoices()
  const plans = usePlans()
  const { tenants } = useTenantDirectory()
  return useMemo(() => {
    const inv = ledger.filter((e) => e.kind === 'Invoice')
    const open = inv.filter((e) => e.status === 'Due' || e.status === 'Overdue')
    const overdue = inv.filter((e) => e.status === 'Overdue')
    const sum = (l: LedgerLine[]) => l.reduce((n, e) => n + e.total - e.credited, 0)
    return {
      outstanding: sum(open),
      openCount: open.length,
      overdueTotal: sum(overdue),
      overdueCount: overdue.length,
      collected: inv.filter((e) => e.status === 'Paid' && e.period === mock.CURRENT_PERIOD).reduce((n, e) => n + e.total, 0),
      collectedPeriod: mock.CURRENT_PERIOD,
      creditedTotal: credits.reduce((n, c) => n + c.amount, 0),
      runRate: tenants.filter((t) => t.directoryStatus === 'active').reduce((n, t) => n + monthlyNet(planByName(plans, t.plan), t.seatsUsed), 0),
      unpaidCount: invoices.filter((i) => i.status !== 'Paid').length,
    }
  }, [ledger, credits, invoices, plans, tenants])
}

/** Everything the tenant detail Billing tab shows. */
export function useTenantBilling(slug: string): TenantBilling {
  const profiles = useBillingProfiles()
  const ledgerAll = useLedger()
  const plans = usePlans()
  const { tenants } = useTenantDirectory()
  const modes = useQuery(tenantDunningQuery()).data ?? NO_MODES
  const groups = useQuery(groupBillingQuery()).data ?? NO_GROUPS
  return useMemo(() => {
    const t = tenants.find((x) => x.slug === slug)
    const profile = profiles[slug] ?? fallbackProfile(t)
    const plan = planByName(plans, t?.plan ?? 'Starter')
    const seatsUsed = t?.seatsUsed ?? 0
    const seatCharge = plan.perSeat * seatsUsed
    const net = plan.base + seatCharge
    const tax = taxOn(net, profile.taxRate)
    const ledger = ledgerAll.filter((e) => e.tenantSlug === slug)
    const open = ledger.filter((e) => e.kind === 'Invoice' && e.status !== 'Paid')
    const kids = tenants.filter((x) => x.parentSlug === slug)
    const groupLines = kids.map((k) => {
      const kp = planByName(plans, k.plan)
      return { slug: k.slug, name: k.name, detail: `${kp.name} · ${k.seatsUsed} seats`, value: monthlyNet(kp, k.seatsUsed) }
    })
    return {
      profile,
      contactSet: profile.contact !== 'Not set',
      dunningMode: modes[slug] ?? 'Platform policy',
      estimate: {
        base: plan.base, seatCharge, seatsUsed, perSeat: plan.perSeat, net, tax, total: net + tax,
        lines: [
          { label: `${plan.name} plan, monthly base`, value: plan.base },
          { label: `${seatsUsed} seats at MVR ${plan.perSeat} each`, value: seatCharge },
          { label: profile.taxRate ? `GST at ${profile.taxRate}%` : 'GST — exempt', value: profile.taxRate ? tax : null },
          { label: 'Estimated next invoice', value: net + tax, strong: true },
        ],
      },
      ledger,
      openCount: open.length,
      openTotal: open.reduce((n, e) => n + e.total - e.credited, 0),
      hasOverdue: open.some((e) => e.status === 'Overdue'),
      group: kids.length
        ? {
            enabled: Boolean(groups[slug]),
            lines: [...groupLines, { slug, name: `${t?.name ?? slug} (parent)`, detail: `${plan.name} · ${seatsUsed} seats`, value: net }],
            total: groupLines.reduce((n, l) => n + l.value, net),
          }
        : null,
    }
  }, [slug, profiles, ledgerAll, plans, tenants, modes, groups])
}

export function useBillingActions() {
  const qc = useQueryClient()
  const swap = useCallback(<T>(k: readonly string[], fn: (v: T) => T): Undo => {
    const before = qc.getQueryData<T>(k)
    qc.setQueryData<T>(k, (v) => fn(v as T))
    return () => qc.setQueryData<T>(k, before)
  }, [qc])
  const patchInvoice = (no: string, changes: Partial<Invoice>) =>
    swap<Invoice[]>(key('invoices'), (l) => l.map((i) => (i.no === no ? { ...i, ...changes } : i)))

  return {
    /** Due/Overdue → Paid. */
    markPaid: (no: string) => patchInvoice(no, { status: 'Paid' }),
    /** Draft → Due, stamps issued date. */
    issue: (no: string) => patchInvoice(no, { status: 'Due', issued: mock.TODAY }),
    /**
     * Credit note or refund against an invoice. Numbered CN-2026-xxx / RF-2026-xxx.
     * Caller should block amount <= 0 or above the invoice total (see LedgerLine.total).
     */
    issueCredit: (input: IssueCreditInput): { no: string; undo: Undo } => {
      const count = (qc.getQueryData<Credit[]>(key('credits')) ?? []).length
      const no = (input.kind === 'Refund' ? 'RF-2026-' : 'CN-2026-') + String(1000 + count).slice(1)
      const credit: Credit = { no, tenantSlug: input.tenantSlug, against: input.against, kind: input.kind, period: mock.CURRENT_PERIOD, date: mock.TODAY, amount: Math.round(input.amount), reason: input.reason || 'No reason given' }
      return { no, undo: swap<Credit[]>(key('credits'), (l) => [...l, credit]) }
    },
    saveProfile: (slug: string, profile: BillingProfile) =>
      swap<Record<string, BillingProfile>>(key('profiles'), (m) => ({ ...m, [slug]: profile })),
    /** Adjusts one platform dunning day (min 1). */
    setDunningDay: (step: DunningStepKey, day: number) =>
      swap<DunningPolicy>(key('dunning'), (p) => ({ ...p, [step]: Math.max(1, day) })),
    setAutoSuspend: (auto: boolean) => swap<DunningPolicy>(key('dunning'), (p) => ({ ...p, auto })),
    /** Per-tenant override; 'Platform policy' clears it. */
    setTenantDunning: (slug: string, mode: TenantDunningMode) =>
      swap<Record<string, TenantDunningMode>>(key('tenant-dunning'), (m) => {
        const next = { ...m }
        if (mode === 'Platform policy') delete next[slug]
        else next[slug] = mode
        return next
      }),
    /** Consolidated invoice for a parent and its children from next cycle. */
    setGroupBilling: (slug: string, enabled: boolean) =>
      swap<Record<string, boolean>>(key('group'), (m) => ({ ...m, [slug]: enabled })),
  }
}

// ——— Bank-transfer payment submissions (tenant uploads a slip, an operator verifies) ———

export const paymentSubmissionsQuery = () => fixture(key('payment-submissions'), mock.PAYMENT_SUBMISSIONS)

export const usePaymentSubmissions = () => useQuery(paymentSubmissionsQuery()).data ?? mock.PAYMENT_SUBMISSIONS
export const usePaymentRejectReasons = () => mock.PAYMENT_REJECT_REASONS

/** A pending submission joined to its invoice line, with the tenant person and the amount check. */
export type PaymentToVerify = {
  submission: PaymentSubmission
  line: LedgerLine | undefined
  tenantSlug: string
  submitterName: string
  /** Invoice total minus credits. */
  expected: number
  amountMatches: boolean
  referenceMatches: boolean
}

/** Pending submissions, oldest first. */
export function usePaymentsToVerify(): PaymentToVerify[] {
  const subs = usePaymentSubmissions()
  const ledger = useLedger()
  const { tenants } = useTenantDirectory()
  return useMemo(() => {
    const people = new Map(tenants.flatMap((t) => t.admins.map((a) => [a.idNo, a.name] as const)))
    return subs
      .filter((s) => s.status === 'Pending verification')
      .sort((a, b) => a.submittedOn.localeCompare(b.submittedOn))
      .map((s) => {
        const line = ledger.find((e) => e.kind === 'Invoice' && e.no === s.invoiceId)
        const expected = line ? line.total - line.credited : 0
        const digits = s.invoiceId.replace(/\D/g, '').slice(-4)
        return {
          submission: s, line, tenantSlug: line?.tenantSlug ?? '', submitterName: people.get(s.submittedBy) ?? s.submittedBy,
          expected, amountMatches: Boolean(line) && Math.round(s.amount) === Math.round(expected),
          referenceMatches: s.reference.toUpperCase().includes(s.invoiceId.toUpperCase()) || s.reference.includes(digits),
        }
      })
  }, [subs, ledger, tenants])
}

export type InvoicePaymentNote = { state: 'review' | 'verified'; submission: PaymentSubmission; reviewerName: string | null }

/** Per invoice no.: 'review' while a submission is pending, else 'verified' with the reviewer's name. */
export function useInvoicePaymentNotes(): Map<string, InvoicePaymentNote> {
  const subs = usePaymentSubmissions()
  const operators = useAdminUsers()
  return useMemo(() => {
    const out = new Map<string, InvoicePaymentNote>()
    for (const s of subs) {
      if (s.status === 'Pending verification') out.set(s.invoiceId, { state: 'review', submission: s, reviewerName: null })
      else if (s.status === 'Verified' && out.get(s.invoiceId)?.state !== 'review') {
        out.set(s.invoiceId, { state: 'verified', submission: s, reviewerName: operators.find((u) => u.idNo === s.reviewedBy)?.name ?? s.reviewedBy ?? null })
      }
    }
    return out
  }, [subs, operators])
}

/** Verify or reject a submission. Both return an undo; verify also marks the linked invoice Paid. */
export function usePaymentActions() {
  const qc = useQueryClient()
  const me = useCurrentUser()
  const operators = useAdminUsers()
  const reviewer = operators.find((u) => u.email === me.email)?.idNo ?? (me.email || 'operator')

  return useMemo(() => {
    const swap = <T>(k: readonly string[], fn: (v: T) => T): Undo => {
      const before = qc.getQueryData<T>(k)
      qc.setQueryData<T>(k, (v) => fn(v as T))
      return () => qc.setQueryData<T>(k, before)
    }
    const patch = (id: string, changes: Partial<PaymentSubmission>) =>
      swap<PaymentSubmission[]>(key('payment-submissions'), (l) => l.map((s) => (s.id === id ? { ...s, ...changes } : s)))
    const find = (id: string) => (qc.getQueryData<PaymentSubmission[]>(key('payment-submissions')) ?? []).find((s) => s.id === id)

    return {
      verify: (id: string): Undo => {
        const s = find(id)
        const undoSub = patch(id, { status: 'Verified', reviewedBy: reviewer, reviewedOn: mock.TODAY_ISO, rejectReason: undefined })
        const undoInv = s ? swap<Invoice[]>(key('invoices'), (l) => l.map((i) => (i.no === s.invoiceId ? { ...i, status: 'Paid' } : i))) : () => {}
        return () => { undoInv(); undoSub() }
      },
      reject: (id: string, reason: string): Undo =>
        patch(id, { status: 'Rejected', reviewedBy: reviewer, reviewedOn: mock.TODAY_ISO, rejectReason: reason.trim() || 'No reason given' }),
    }
  }, [qc, reviewer])
}
