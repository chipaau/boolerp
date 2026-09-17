// The billing data seam. Components read only through these hooks; the query functions are the
// single place that changes at integration. Mutations update the cache in place and return undo.
import { queryOptions, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo } from 'react'
import { useNotify } from '@/features/notifications/notify'
import { isOnBooks } from '@/features/org/logic'
import { useAudit, useAuditLog, useOrgMe, usePeople } from '@/features/org/queries'
import { autoIssuedNumbers, autoIssuedText, fmtIso, formatMoney, invoicesToGenerate, receiptStorageKey, round2 } from './logic'
import { isoDate } from '@/lib/dates'
import * as mock from './mock'
import type { BillingContact, PayeeDetails, PaymentBank, PaymentSubmission, PlanChangeRequest, PlanName, Subscription, TenantInvoice } from './types'

const key = (...parts: string[]) => ['billing', ...parts] as const

export const subscriptionQuery = () => queryOptions({ queryKey: key('subscription'), queryFn: async (): Promise<Subscription> => mock.SUBSCRIPTION })
export const invoicesQuery = () => queryOptions({ queryKey: key('invoices'), queryFn: async (): Promise<TenantInvoice[]> => mock.INVOICES })
export const billingContactQuery = () => queryOptions({ queryKey: key('contact'), queryFn: async (): Promise<BillingContact> => mock.CONTACT })
export const paymentsQuery = () => queryOptions({ queryKey: key('payments'), queryFn: async (): Promise<PaymentSubmission[]> => mock.PAYMENTS })
export const payeeQuery = () => queryOptions({ queryKey: key('payee'), queryFn: async (): Promise<PayeeDetails> => mock.PAYEE, staleTime: Infinity })
export const planRequestsQuery = () => queryOptions({ queryKey: key('plan-requests'), queryFn: async (): Promise<PlanChangeRequest[]> => mock.PLAN_REQUESTS })

/** The subscription, with seats used counted from people on the books. */
export function useSubscription(): Subscription {
  const sub = useSuspenseQuery(subscriptionQuery()).data
  const people = usePeople()
  return useMemo(() => ({ ...sub, seatsUsed: people.filter(isOnBooks).length }), [sub, people])
}
export const useInvoices = () => useSuspenseQuery(invoicesQuery()).data
export const useBillingContact = () => useSuspenseQuery(billingContactQuery()).data
export const usePlanRequests = () => useSuspenseQuery(planRequestsQuery()).data
/** Every payment submitted against this tenant's invoices. */
export const usePayments = () => useSuspenseQuery(paymentsQuery()).data
/** Bool's receiving bank accounts (a platform setting; read-only). */
export const usePayeeDetails = () => useSuspenseQuery(payeeQuery()).data

// Fixture stand-in for object storage: slips uploaded this session, by storage key. At integration
// the file is uploaded to that key and the API hands back a signed link instead.
const receiptUrls = new Map<string, string>()
/** A viewable link for a stored slip, when there is one this session. */
export const receiptUrl = (storageKey: string) => receiptUrls.get(storageKey)

/** This tenant's slug, as the storage path uses it. */
const tenantSlug = () => window.location.hostname.split('.')[0] || 'workspace'

export type PaymentDraft = { invoices: TenantInvoice[]; bank: PaymentBank; reference: string; paidOn: string; amount: number; note: string; file: File }

type Undo = () => void

export function useBillingActions() {
  const qc = useQueryClient()
  const log = useAuditLog()
  const me = useOrgMe()
  const notify = useNotify()
  const updateContact = useCallback(
    (next: BillingContact): Undo => {
      const before = qc.getQueryData<BillingContact>(key('contact'))
      qc.setQueryData<BillingContact>(key('contact'), next)
      log('Billing', 'Billing contact updated')
      return () => before && qc.setQueryData<BillingContact>(key('contact'), before)
    },
    [qc, log]
  )
  const requestChange = useCallback(
    (r: { plan: PlanName; seats: number; note: string }): Undo => {
      const id = `pcr-${Date.now().toString(36)}`
      const req: PlanChangeRequest = { ...r, id, requestedBy: me.id, requestedOn: isoDate(new Date()), status: 'Pending' }
      qc.setQueryData<PlanChangeRequest[]>(key('plan-requests'), (list) => [req, ...(list ?? [])])
      log('Billing', `Plan change requested: ${r.plan}, ${r.seats} seats`)
      return () => qc.setQueryData<PlanChangeRequest[]>(key('plan-requests'), (list) => (list ?? []).filter((x) => x.id !== id))
    },
    [qc, log, me.id]
  )
  /** Withdraws a pending request (the operator never saw it through). */
  const cancelRequest = useCallback(
    (id: string): Undo => {
      const list = qc.getQueryData<PlanChangeRequest[]>(key('plan-requests')) ?? []
      qc.setQueryData<PlanChangeRequest[]>(key('plan-requests'), list.filter((x) => x.id !== id))
      log('Billing', 'Plan change request withdrawn')
      return () => qc.setQueryData<PlanChangeRequest[]>(key('plan-requests'), list)
    },
    [qc, log]
  )
  /**
   * Records a transfer against one or more invoices: one submission per invoice, all pending
   * verification and sharing the slip. With a single invoice the amount is what was entered; with
   * several each carries its own total. Returns an undo that withdraws them.
   */
  const submitPayment = useCallback(
    (d: PaymentDraft): Undo => {
      const stamp = Date.now().toString(36)
      const url = URL.createObjectURL(d.file)
      const submittedOn = isoDate(new Date())
      const made: PaymentSubmission[] = d.invoices.map((inv, n) => {
        const id = `pay-${stamp}${d.invoices.length > 1 ? `-${n + 1}` : ''}`
        const storageKey = receiptStorageKey(tenantSlug(), id, d.file.name)
        receiptUrls.set(storageKey, url)
        return {
          id,
          invoiceId: inv.id,
          amount: round2(d.invoices.length > 1 ? inv.total : d.amount),
          currency: inv.currency,
          method: 'Bank transfer',
          bank: d.bank,
          reference: d.reference.trim(),
          paidOn: d.paidOn,
          receipt: { fileName: d.file.name, mimeType: d.file.type, sizeBytes: d.file.size, storageKey },
          ...(d.note.trim() ? { note: d.note.trim() } : {}),
          submittedBy: me.id,
          submittedOn,
          status: 'Pending verification',
        }
      })
      const ids = new Set(made.map((p) => p.id))
      qc.setQueryData<PaymentSubmission[]>(key('payments'), (list) => [...made, ...(list ?? [])])
      const numbers = d.invoices.map((i) => i.number).join(', ')
      const total = round2(made.reduce((t, p) => t + p.amount, 0))
      const currency = d.invoices[0]?.currency
      log('Billing', `Payment submitted for ${numbers}: ${formatMoney(total, currency)} by ${d.bank} transfer ${d.reference.trim()}`)
      const unnotify = notify('billing.payment_submitted', {
        title: `Payment submitted for ${numbers}`,
        meta: `${formatMoney(total, currency)} · awaiting verification by Bool`,
        category: 'Billing',
        to: { app: 'control-centre', section: 'billing', id: d.invoices[0]?.id },
      })
      return () => {
        qc.setQueryData<PaymentSubmission[]>(key('payments'), (list) => (list ?? []).filter((p) => !ids.has(p.id)))
        for (const p of made) receiptUrls.delete(p.receipt.storageKey)
        URL.revokeObjectURL(url)
        unnotify()
        log('Billing', `Payment for ${numbers} withdrawn`)
      }
    },
    [qc, log, me.id, notify]
  )
  return useMemo(() => ({ updateContact, requestChange, cancelRequest, submitPayment }), [updateContact, requestChange, cancelRequest, submitPayment])
}

/**
 * Issues every invoice whose period has ended and has none yet, once on load: into the cache,
 * the audit and the admins' notifications. Idempotent, so mounting it twice issues nothing twice.
 * At integration this goes away: a scheduled API job issues invoices and the query just reads them.
 */
export function useAutoInvoicing() {
  const qc = useQueryClient()
  const sub = useSubscription()
  const log = useAuditLog()
  const notify = useNotify()
  useEffect(() => {
    const existing = qc.getQueryData<TenantInvoice[]>(key('invoices')) ?? []
    const fresh = invoicesToGenerate(existing, sub, isoDate(new Date()), mock.TENANT_GST_RATE)
    if (!fresh.length) return
    qc.setQueryData<TenantInvoice[]>(key('invoices'), (list) => [...fresh].reverse().concat(list ?? []))
    for (const inv of fresh) {
      log('Billing', autoIssuedText(inv.number))
      notify('billing.invoice_issued', {
        title: `Invoice ${inv.number} issued`,
        meta: `${formatMoney(inv.total, inv.currency)} · due ${fmtIso(inv.dueOn)}`,
        category: 'Billing',
        to: { app: 'control-centre', section: 'billing', id: inv.id },
      })
    }
  }, [qc, sub, log, notify])
}

/** Numbers of invoices that were issued automatically, read back from the audit. */
export function useAutoIssuedNumbers() {
  const audit = useAudit()
  return useMemo(() => autoIssuedNumbers(audit.filter((a) => a.scope === 'Billing').map((a) => a.text)), [audit])
}

/** The GST percent this tenant's invoices carry. */
export const useGstRate = () => mock.TENANT_GST_RATE
