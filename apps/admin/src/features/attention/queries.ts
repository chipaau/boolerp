// Sidebar "Needs attention" list and nav hint counts, derived from the other features' hooks.
// No fixtures of its own, so nothing here changes at integration.
import { useCallback, useMemo, useState } from 'react'
import { useAdminUsers } from '@/features/admin-users/queries'
import { useBillingSummary, useInvoices, usePaymentSubmissions } from '@/features/billing/queries'
import { useGeographies } from '@/features/geographies/queries'
import { isNearSeatLimit, isNotLive } from '@/features/tenants/logic'
import { useTenantDirectory } from '@/features/tenants/queries'

export type AttentionKey = 'tenants-not-live' | 'invites' | 'payments-to-verify' | 'invoices-overdue' | 'near-seat-limit' | 'unused-geographies'

/** Dot colour, in design order: amber, rust (danger), gold, muted. */
export type AttentionTone = 'warning' | 'danger' | 'caution' | 'muted'

/** Where the item links: a route plus the filter the design pre-applies there. */
export type AttentionTarget =
  | { to: '/tenants'; search: { status: 'pending' | 'active' } }
  | { to: '/admin-users'; search: { invite: 'Invited' } }
  | { to: '/billing'; search: { status: 'Overdue' } }
  | { to: '/billing'; search: { view: 'payments' } }
  | { to: '/geographies'; search: { tab: 'places' } }

export type AttentionItem = { key: AttentionKey; label: string; count: number; tone: AttentionTone; target: AttentionTarget }

/** Items with a count above zero, in design order. Empty → show "Nothing needs a look right now." */
export function useAttention(): AttentionItem[] {
  const { tenants } = useTenantDirectory()
  const users = useAdminUsers()
  const invoices = useInvoices()
  const geos = useGeographies()
  const payments = usePaymentSubmissions()
  return useMemo(() => {
    const pendingInvites = users.filter((u) => u.invite !== 'Accepted').length
    const expired = users.some((u) => u.invite === 'Expired')
    const items: AttentionItem[] = [
      { key: 'tenants-not-live', label: 'Tenants not yet live', count: tenants.filter((t) => isNotLive(t.directoryStatus)).length, tone: 'warning', target: { to: '/tenants', search: { status: 'pending' } } },
      { key: 'invites', label: 'Invites waiting or expired', count: pendingInvites, tone: expired ? 'danger' : 'warning', target: { to: '/admin-users', search: { invite: 'Invited' } } },
      { key: 'payments-to-verify', label: 'Payments to verify', count: payments.filter((p) => p.status === 'Pending verification').length, tone: 'warning', target: { to: '/billing', search: { view: 'payments' } } },
      { key: 'invoices-overdue', label: 'Invoices overdue', count: invoices.filter((i) => i.status === 'Overdue').length, tone: 'danger', target: { to: '/billing', search: { status: 'Overdue' } } },
      { key: 'near-seat-limit', label: 'Tenants near their seat limit', count: tenants.filter(isNearSeatLimit).length, tone: 'caution', target: { to: '/tenants', search: { status: 'active' } } },
      { key: 'unused-geographies', label: 'Geographies nobody uses', count: geos.filter((g) => !g.use && g.status !== 'Inactive').length, tone: 'muted', target: { to: '/geographies', search: { tab: 'places' } } },
    ]
    return items.filter((a) => a.count > 0)
  }, [tenants, users, invoices, payments, geos])
}

export type NavHints = { tenants: number; billing: number; geographies: number; adminUsers: number }

/** Counts shown beside each sidebar nav item: tenants in directory, invoices needing action (unpaid, or with a payment to verify), geographies, admin users. */
export function useNavHints(): NavHints {
  const { tenants } = useTenantDirectory()
  const { unpaidCount } = useBillingSummary()
  const invoices = useInvoices()
  // pending slips on invoices already counted as unpaid aren't counted twice
  const unpaid = new Set(invoices.filter((i) => i.status !== 'Paid').map((i) => i.no))
  const pendingPayments = usePaymentSubmissions().filter((p) => p.status === 'Pending verification' && !unpaid.has(p.invoiceId)).length
  const geos = useGeographies()
  const users = useAdminUsers()
  return { tenants: tenants.length, billing: unpaidCount + pendingPayments, geographies: geos.length, adminUsers: users.length }
}

/** One row in the header bell: a single record behind an attention count, linking to its screen. */
export type AttentionNotification = { id: string; title: string; time: string; category: string; unread: boolean; target: AttentionTarget }

const NOT_LIVE_LABEL: Partial<Record<string, string>> = { pending: 'Pending activation', provisioning: 'Provisioning', draft: 'Draft' }

const READ_KEY ='bool-admin:notifications-read'

function loadRead(): string[] {
  try {
    const raw = window.localStorage.getItem(READ_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

function saveRead(ids: string[]) {
  try {
    window.localStorage.setItem(READ_KEY, JSON.stringify(ids))
  } catch {
    // storage blocked: read state lasts for this page only
  }
}

/**
 * Header bell items, derived from the same sources as the attention list (payments to verify,
 * overdue invoices, invites waiting or expired, tenants not yet live), one per record. Read state is
 * per browser, keyed by item id; nothing here changes at integration beyond the sources' own hooks.
 */
export function useAttentionNotifications() {
  const { tenants } = useTenantDirectory()
  const users = useAdminUsers()
  const invoices = useInvoices()
  const payments = usePaymentSubmissions()
  const [read, setRead] = useState<string[]>(loadRead)

  const items = useMemo(() => {
    const readSet = new Set(read)
    const rows: Omit<AttentionNotification, 'unread'>[] = [
      ...payments
        .filter((p) => p.status === 'Pending verification')
        .map((p) => ({ id: `payment:${p.id}`, title: `Payment to verify for ${p.invoiceId}`, time: `Paid ${p.paidOn}`, category: 'Billing', target: { to: '/billing', search: { view: 'payments' } } as const })),
      ...invoices
        .filter((i) => i.status === 'Overdue')
        .map((i) => ({ id: `invoice:${i.no}`, title: `Invoice ${i.no} is overdue`, time: `Due ${i.due}`, category: 'Billing', target: { to: '/billing', search: { status: 'Overdue' } } as const })),
      ...users
        .filter((u) => u.invite !== 'Accepted')
        .map((u) => ({ id: `invite:${u.idNo}:${u.invite}`, title: u.invite === 'Expired' ? `Invite expired for ${u.name}` : `Invite waiting for ${u.name}`, time: u.scope, category: 'Admin users', target: { to: '/admin-users', search: { invite: 'Invited' } } as const })),
      ...tenants
        .filter((t) => isNotLive(t.directoryStatus))
        .map((t) => ({ id: `tenant:${t.slug}:${t.directoryStatus}`, title: `${t.name} is not live yet`, time: NOT_LIVE_LABEL[t.directoryStatus] ?? 'Pending activation', category: 'Tenants', target: { to: '/tenants', search: { status: 'pending' } } as const })),
    ]
    return rows.map((r): AttentionNotification => ({ ...r, unread: !readSet.has(r.id) }))
  }, [tenants, users, invoices, payments, read])

  const markAllRead = useCallback(() => {
    const ids = items.map((i) => i.id)
    setRead(ids)
    saveRead(ids)
  }, [items])

  const markRead = useCallback((id: string) => {
    setRead((prev) => {
      if (prev.includes(id)) return prev
      const next = [...prev, id]
      saveRead(next)
      return next
    })
  }, [])

  return { items, markAllRead, markRead }
}
