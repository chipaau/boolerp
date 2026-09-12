import { useMemo } from 'react'
import { APP_KEYS, appRoleRank, isOnBooks, liveUnits, siteStaff, siteTypeById, unitMembers, binFills } from '@/features/org/logic'
import { usePeople, useSiteTypes, useSites, useUnits } from '@/features/org/queries'

export type Attention = { label: string; count: number; tone: 'warning' | 'neutral' | 'risk'; to: { section: string; search?: Record<string, string> } }

/** What in the record would stop another app working, worst first. Shared by the rail and the overview. */
export function useAttention(): Attention[] {
  const units = useUnits(), people = usePeople(), sites = useSites(), types = useSiteTypes()
  return useMemo(() => {
    const out: Attention[] = []
    const paused = sites.filter((s) => s.status === 'Paused')
    if (paused.length) out.push({ label: 'Paused sites', count: paused.length, tone: 'warning', to: { section: 'sites', search: { filter: 'Paused' } } })
    const noBins = sites.filter((s) => siteTypeById(types, s.typeId).bins && !s.bins)
    if (noBins.length) out.push({ label: 'Bins not set up', count: noBins.length, tone: 'warning', to: { section: 'sites', search: { id: noBins[0].id } } })
    const nearFull = sites.filter((s) => s.lines && s.bins && binFills(s).some((p) => p >= 90))
    if (nearFull.length) out.push({ label: 'Bins near capacity', count: nearFull.length, tone: 'warning', to: { section: 'sites', search: { id: nearFull[0].id } } })
    const uncounted = sites.filter((s) => siteTypeById(types, s.typeId).cadence !== 'None' && s.counted === '—')
    if (uncounted.length) out.push({ label: 'Never counted', count: uncounted.length, tone: 'warning', to: { section: 'sites', search: { id: uncounted[0].id } } })
    const unused = types.filter((t) => !sites.some((s) => s.typeId === t.id))
    if (unused.length) out.push({ label: 'Types with no sites', count: unused.length, tone: 'neutral', to: { section: 'site-types', search: { id: unused[0].id } } })
    const preStart = people.filter((p) => isOnBooks(p) && p.status === 'Not started')
    if (preStart.length) out.push({ label: 'Starting soon, access held', count: preStart.length, tone: 'warning', to: { section: 'employees', search: { filter: 'Not started' } } })
    const stranded = people.filter((p) => isOnBooks(p) && p.status === 'Active' && !p.primarySite && appRoleRank('Inventory', p.perms.Inventory) >= 2 && p.role !== 'Admin')
    if (stranded.length) out.push({ label: 'Stock role, no site', count: stranded.length, tone: 'warning', to: { section: 'employees', search: { id: stranded[0].id } } })
    const empty = liveUnits(units).filter((u) => !unitMembers(people, units, u.id, true).length)
    if (empty.length) out.push({ label: 'Units with no one in them', count: empty.length, tone: 'neutral', to: { section: 'units', search: { id: empty[0].id } } })
    const ghosts = people.filter((p) => !p.external && p.status === 'Exited' && (p.primarySite || p.access.length || APP_KEYS.some((a) => p.perms[a] !== 'None')))
    if (ghosts.length) out.push({ label: 'Exited people still holding access', count: ghosts.length, tone: 'risk', to: { section: 'employees', search: { filter: 'Exited' } } })
    const uncovered = sites.filter((s) => !siteStaff(people, s.id).length)
    if (uncovered.length) out.push({ label: 'Sites with nobody assigned', count: uncovered.length, tone: 'warning', to: { section: 'sites', search: { id: uncovered[0].id } } })
    return out
  }, [units, people, sites, types])
}
