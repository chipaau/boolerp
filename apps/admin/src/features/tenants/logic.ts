// Pure derivations over tenants. No fixtures, no hooks — stays at integration.
import type { DesignStatus, DirectoryStatus, DirectoryTenant, Plan, PlanName, TenantAdmin, TenantStatus } from './types'

export const fromApiStatus = (s: TenantStatus): DirectoryStatus => s
export const fromDesignStatus = (s: DesignStatus): DirectoryStatus =>
  s === 'Active' ? 'active' : s === 'Suspended' ? 'suspended' : s === 'Draft' ? 'draft' : 'pending'

/** Display label for a directory status, in the design's words. */
export const statusLabel = (s: DirectoryStatus): string =>
  ({ active: 'Active', suspended: 'Suspended', archived: 'Archived', provisioning: 'Provisioning', pending: 'Pending activation', draft: 'Draft' })[s]

/** Not yet live: pending activation, provisioning or draft. */
export const isNotLive = (s: DirectoryStatus) => s === 'pending' || s === 'provisioning' || s === 'draft'

/** 0–100; 0 when the limit is 0. */
export const seatPct = (t: { seatsUsed: number; seatLimit: number }) => (t.seatLimit ? Math.round((t.seatsUsed / t.seatLimit) * 100) : 0)
/** Design threshold: over 90% of the seat limit. */
export const isNearSeatLimit = (t: { seatsUsed: number; seatLimit: number }) => t.seatLimit > 0 && t.seatsUsed / t.seatLimit > 0.9

export const pendingAdmins = (admins: TenantAdmin[]) => admins.filter((a) => a.invite !== 'Accepted').length

export const planByName = (plans: Plan[], name: PlanName): Plan => plans.find((p) => p.name === name) ?? plans[1]

/** Monthly charge before tax at today's seats in use. */
export const monthlyNet = (plan: Plan, seatsUsed: number) => plan.base + plan.perSeat * seatsUsed

export const childrenOf = (list: DirectoryTenant[], slug: string) => list.filter((t) => t.parentSlug === slug)

/** Parents followed by their children (the tenants list order); orphans whose parent is filtered out go last. */
export function orderByHierarchy(list: DirectoryTenant[]): { tenant: DirectoryTenant; isChild: boolean }[] {
  const out: { tenant: DirectoryTenant; isChild: boolean }[] = []
  for (const p of list.filter((t) => !t.parentSlug)) {
    out.push({ tenant: p, isChild: false })
    for (const c of list.filter((t) => t.parentSlug === p.slug)) out.push({ tenant: c, isChild: true })
  }
  for (const t of list) if (t.parentSlug && !out.some((o) => o.tenant.slug === t.slug)) out.push({ tenant: t, isChild: true })
  return out
}
