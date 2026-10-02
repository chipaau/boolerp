import { useMemo } from 'react'
import { APP_KEYS, appRoleRank, binFills, holidayOn, isOnBooks, liveUnits, nextCountDue, siteStaff, siteTypeById, unitMembers } from '@workspace/org/logic'
import { useHolidays, usePeople, usePersonActions, useSiteActions, useSiteTypes, useSites, useUnits } from '@workspace/org/queries'
import { isUnderReview } from '../billing'
import { useInvoices, usePayments } from '../billing'
import type { Person } from '@workspace/org/types'

/** A one-click repair across every affected item; `apply` returns the undo. */
export type AttentionFix = { label: string; done: string; apply: () => () => void }
export type Attention = {
  label: string
  count: number
  tone: 'warning' | 'neutral' | 'risk'
  to: { section: string; search?: Record<string, string> }
  /** The records behind the count, in list order. */
  items: { id: string; name: string }[]
  fix?: AttentionFix
}

const named = (list: { id: string; name: string }[]) => list.map(({ id, name }) => ({ id, name }))
const undoAll = (undos: (() => void)[]) => () => [...undos].reverse().forEach((u) => u())

/**
 * Every check the record runs: `open` is what would stop another app working, worst first;
 * `clear` names the checks that currently pass, so the overview never reads as empty.
 */
export function useAttentionReport(): { open: Attention[]; clear: string[] } {
  const units = useUnits(), people = usePeople(), sites = useSites(), types = useSiteTypes(), holidays = useHolidays()
  const siteActions = useSiteActions(), personActions = usePersonActions()
  const invoices = useInvoices(), payments = usePayments()
  return useMemo(() => {
    const open: Attention[] = [], clear: string[] = []
    const check = (list: { id: string; name: string }[], pass: string, a: Omit<Attention, 'count' | 'items'>) => {
      if (list.length) open.push({ ...a, count: list.length, items: named(list) })
      else clear.push(pass)
    }
    const today = new Date()

    const paused = sites.filter((s) => s.status === 'Paused')
    check(paused, 'No sites are paused', {
      label: 'Paused sites', tone: 'warning', to: { section: 'sites', search: { filter: 'Paused' } },
      fix: { label: paused.length === 1 ? 'Reopen site' : 'Reopen all', done: `${paused.length === 1 ? paused[0]?.name : `${paused.length} sites`} reopened`, apply: () => undoAll(paused.map((s) => siteActions.setStatus(s.id, 'Active'))) },
    })
    const noBins = sites.filter((s) => siteTypeById(types, s.typeId).bins && !s.bins)
    check(noBins, 'Every site that uses bins has them set up', { label: 'Bins not set up', tone: 'warning', to: { section: 'sites', search: { id: noBins[0]?.id ?? '' } } })
    const nearFull = sites.filter((s) => s.lines && s.bins && binFills(s).some((p) => p >= 90))
    check(nearFull, 'No bins are near capacity', { label: 'Bins near capacity', tone: 'warning', to: { section: 'sites', search: { id: nearFull[0]?.id ?? '' } } })
    const uncounted = sites.filter((s) => siteTypeById(types, s.typeId).cadence !== 'None' && s.counted === '—')
    check(uncounted, 'Every counted site has had a count', { label: 'Never counted', tone: 'warning', to: { section: 'sites', search: { id: uncounted[0]?.id ?? '' } } })
    const onHoliday = sites.filter((s) => { const due = nextCountDue(s, siteTypeById(types, s.typeId), today); return s.status === 'Active' && !!due && !!holidayOn(holidays, due, { site: s.id }) })
    check(onHoliday, 'No count falls due on a holiday', { label: 'Count due on a holiday', tone: 'warning', to: { section: 'sites', search: { id: onHoliday[0]?.id ?? '' } } })
    const unused = types.filter((t) => !sites.some((s) => s.typeId === t.id))
    check(unused, 'Every site type is in use', { label: 'Types with no sites', tone: 'neutral', to: { section: 'site-types', search: { id: unused[0]?.id ?? '' } } })
    const preStart = people.filter((p) => isOnBooks(p) && p.status === 'Not started')
    check(preStart, 'Nobody is waiting to start', { label: 'Starting soon, access held', tone: 'warning', to: { section: 'employees', search: { filter: 'Not started' } } })
    const stranded = people.filter((p) => isOnBooks(p) && p.status === 'Active' && !p.primarySite && appRoleRank('Inventory', p.perms.Inventory) >= 2 && p.role !== 'Admin')
    check(stranded, 'Everyone with a stock role has a site', { label: 'Stock role, no site', tone: 'warning', to: { section: 'employees', search: { id: stranded[0]?.id ?? '' } } })
    const empty = liveUnits(units).filter((u) => !unitMembers(people, units, u.id, true).length)
    check(empty, 'Every unit has someone in it', { label: 'Units with no one in them', tone: 'neutral', to: { section: 'units', search: { id: empty[0]?.id ?? '' } } })
    const ghosts = people.filter((p) => !p.external && p.status === 'Exited' && (p.primarySite || p.access.length || APP_KEYS.some((a) => p.perms[a] !== 'None')))
    const noPerms = Object.fromEntries(APP_KEYS.map((a) => [a, 'None'])) as Person['perms']
    check(ghosts, 'No exited person still holds access', {
      label: 'Exited people still holding access', tone: 'risk', to: { section: 'employees', search: { filter: 'Exited' } },
      fix: { label: 'Revoke access', done: `Access revoked for ${ghosts.length === 1 ? ghosts[0]?.name : `${ghosts.length} people`}`, apply: () => undoAll(ghosts.map((p) => personActions.exit(p.id, noPerms))) },
    })
    const uncovered = sites.filter((s) => !siteStaff(people, s.id).length)
    check(uncovered, 'Every site has someone assigned', { label: 'Sites with nobody assigned', tone: 'warning', to: { section: 'sites', search: { id: uncovered[0]?.id ?? '' } } })
    // an overdue invoice whose slip is awaiting verification is already being dealt with
    const overdueInvoices = invoices.filter((i) => i.status === 'Overdue' && !isUnderReview(i, payments)).map((i) => ({ id: i.id, name: i.number }))
    check(overdueInvoices, 'No invoices are overdue', { label: 'Overdue invoices', tone: 'risk', to: { section: 'billing' } })
    return { open, clear }
  }, [units, people, sites, types, holidays, siteActions, personActions, invoices, payments])
}

/** What in the record would stop another app working, worst first. Shared by the rail and the overview. */
export const useAttention = (): Attention[] => useAttentionReport().open
