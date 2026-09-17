// Sidebar "Needs attention" list and nav hint counts, derived from the other features' hooks.
// No fixtures of its own, so nothing here changes at integration.
import { useMemo } from 'react'
import { useAdminUsers } from '@/features/admin-users/queries'
import { useBillingSummary, useInvoices } from '@/features/billing/queries'
import { useGeographies } from '@/features/geographies/queries'
import { isNearSeatLimit, isNotLive } from '@/features/tenants/logic'
import { useTenantDirectory } from '@/features/tenants/queries'

export type AttentionKey = 'tenants-not-live' | 'invites' | 'invoices-overdue' | 'near-seat-limit' | 'unused-geographies'

/** Dot colour, in design order: amber, rust (danger), gold, muted. */
export type AttentionTone = 'warning' | 'danger' | 'caution' | 'muted'

/** Where the item links: a route plus the filter the design pre-applies there. */
export type AttentionTarget =
  | { to: '/tenants'; search: { status: 'pending' | 'active' } }
  | { to: '/admin-users'; search: { invite: 'Invited' } }
  | { to: '/billing'; search: { status: 'Overdue' } }
  | { to: '/geographies'; search: { tab: 'places' } }

export type AttentionItem = { key: AttentionKey; label: string; count: number; tone: AttentionTone; target: AttentionTarget }

/** Items with a count above zero, in design order. Empty → show "Nothing needs a look right now." */
export function useAttention(): AttentionItem[] {
  const { tenants } = useTenantDirectory()
  const users = useAdminUsers()
  const invoices = useInvoices()
  const geos = useGeographies()
  return useMemo(() => {
    const pendingInvites = users.filter((u) => u.invite !== 'Accepted').length
    const expired = users.some((u) => u.invite === 'Expired')
    const items: AttentionItem[] = [
      { key: 'tenants-not-live', label: 'Tenants not yet live', count: tenants.filter((t) => isNotLive(t.directoryStatus)).length, tone: 'warning', target: { to: '/tenants', search: { status: 'pending' } } },
      { key: 'invites', label: 'Invites waiting or expired', count: pendingInvites, tone: expired ? 'danger' : 'warning', target: { to: '/admin-users', search: { invite: 'Invited' } } },
      { key: 'invoices-overdue', label: 'Invoices overdue', count: invoices.filter((i) => i.status === 'Overdue').length, tone: 'danger', target: { to: '/billing', search: { status: 'Overdue' } } },
      { key: 'near-seat-limit', label: 'Tenants near their seat limit', count: tenants.filter(isNearSeatLimit).length, tone: 'caution', target: { to: '/tenants', search: { status: 'active' } } },
      { key: 'unused-geographies', label: 'Geographies nobody uses', count: geos.filter((g) => !g.use && g.status !== 'Inactive').length, tone: 'muted', target: { to: '/geographies', search: { tab: 'places' } } },
    ]
    return items.filter((a) => a.count > 0)
  }, [tenants, users, invoices, geos])
}

export type NavHints = { tenants: number; billing: number; geographies: number; adminUsers: number }

/** Counts shown beside each sidebar nav item: tenants in directory, unpaid invoices, geographies, admin users. */
export function useNavHints(): NavHints {
  const { tenants } = useTenantDirectory()
  const { unpaidCount } = useBillingSummary()
  const geos = useGeographies()
  const users = useAdminUsers()
  return { tenants: tenants.length, billing: unpaidCount, geographies: geos.length, adminUsers: users.length }
}
