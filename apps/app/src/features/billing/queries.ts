// The billing data seam. Components read only through these hooks; the query functions are the
// single place that changes at integration. Mutations update the cache in place and return undo.
import { queryOptions, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import { isOnBooks } from '@/features/org/logic'
import { useAuditLog, useOrgMe, usePeople } from '@/features/org/queries'
import { isoDate } from '@/lib/dates'
import * as mock from './mock'
import type { BillingContact, PlanChangeRequest, PlanName, Subscription, TenantInvoice } from './types'

const key = (...parts: string[]) => ['billing', ...parts] as const

export const subscriptionQuery = () => queryOptions({ queryKey: key('subscription'), queryFn: async (): Promise<Subscription> => mock.SUBSCRIPTION })
export const invoicesQuery = () => queryOptions({ queryKey: key('invoices'), queryFn: async (): Promise<TenantInvoice[]> => mock.INVOICES })
export const billingContactQuery = () => queryOptions({ queryKey: key('contact'), queryFn: async (): Promise<BillingContact> => mock.CONTACT })
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

type Undo = () => void

export function useBillingActions() {
  const qc = useQueryClient()
  const log = useAuditLog()
  const me = useOrgMe()
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
  return useMemo(() => ({ updateContact, requestChange, cancelRequest }), [updateContact, requestChange, cancelRequest])
}
