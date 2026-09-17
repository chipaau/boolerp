// The organisation data seam. Components read only through these hooks; the query functions are
// the single place that changes at integration (fixture → generated API client). Control Centre's
// mutations update the cache in place and write an audit entry; later they PATCH then invalidate.
import { queryOptions, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { useCallback } from 'react'
import { useNotify } from '@/features/notifications/notify'
import { fmtDate, fmtIsoDay, nextCode, nextCountDue, personById, siteTypeById, unitKids, unitPath } from './logic'
import * as mock from './mock'
import type { ApprovalChain, AuditEntry, NotificationRule, Country, Holiday, Me, NumberingRule, Person, Region, Site, SiteType, Unit } from './types'

const key = (...parts: string[]) => ['org', ...parts] as const

export const unitsQuery = () => queryOptions({ queryKey: key('units'), queryFn: async (): Promise<Unit[]> => mock.UNITS })
export const peopleQuery = () => queryOptions({ queryKey: key('people'), queryFn: async (): Promise<Person[]> => mock.PEOPLE })
export const sitesQuery = () => queryOptions({ queryKey: key('sites'), queryFn: async (): Promise<Site[]> => mock.SITES })
export const siteTypesQuery = () => queryOptions({ queryKey: key('site-types'), queryFn: async (): Promise<SiteType[]> => mock.SITE_TYPES })
export const countriesQuery = () => queryOptions({ queryKey: key('countries'), queryFn: async (): Promise<Country[]> => mock.COUNTRIES })
export const regionsQuery = () => queryOptions({ queryKey: key('regions'), queryFn: async (): Promise<Region[]> => mock.REGIONS })
export const holidaysQuery = () => queryOptions({ queryKey: key('holidays'), queryFn: async (): Promise<Holiday[]> => mock.HOLIDAYS })
export const approvalChainsQuery = () => queryOptions({ queryKey: key('approval-chains'), queryFn: async (): Promise<ApprovalChain[]> => mock.APPROVAL_CHAINS })
export const notificationRulesQuery = () => queryOptions({ queryKey: key('notification-rules'), queryFn: async (): Promise<NotificationRule[]> => mock.NOTIFICATION_RULES })
export const numberingQuery = () => queryOptions({ queryKey: key('numbering'), queryFn: async (): Promise<NumberingRule[]> => mock.NUMBERING })
export const auditQuery = () => queryOptions({ queryKey: key('audit'), queryFn: async (): Promise<AuditEntry[]> => mock.AUDIT })
export const orgMeQuery = () => queryOptions({ queryKey: key('me'), queryFn: async (): Promise<Me> => mock.ME })
export const defaultSiteQuery = () => queryOptions({ queryKey: key('default-site'), queryFn: async () => mock.DEFAULT_SITE })

export const useUnits = () => useSuspenseQuery(unitsQuery()).data
export const usePeople = () => useSuspenseQuery(peopleQuery()).data
export const useSites = () => useSuspenseQuery(sitesQuery()).data
export const useSiteTypes = () => useSuspenseQuery(siteTypesQuery()).data
export const useCountries = () => useSuspenseQuery(countriesQuery()).data
export const useRegions = () => useSuspenseQuery(regionsQuery()).data
export const useHolidays = () => useSuspenseQuery(holidaysQuery()).data
export const useApprovalChains = () => useSuspenseQuery(approvalChainsQuery()).data
export const useNotificationRules = () => useSuspenseQuery(notificationRulesQuery()).data
export const useNumbering = () => useSuspenseQuery(numberingQuery()).data
export const useAudit = () => useSuspenseQuery(auditQuery()).data
export const useOrgMe = () => useSuspenseQuery(orgMeQuery()).data
export const useDefaultSite = () => useSuspenseQuery(defaultSiteQuery()).data

type Undo = () => void

/** Writes one line to the activity log as the signed-in person. */
export function useAuditLog() {
  const qc = useQueryClient()
  return useCallback(
    (scope: string, text: string, sev: AuditEntry['sev'] = 'normal') => {
      const me = personById(qc.getQueryData<Person[]>(key('people')) ?? [], (qc.getQueryData<Me>(key('me')) ?? mock.ME).id)
      const entry: AuditEntry = { id: `a-${Date.now().toString(36)}`, scope, app: 'Control Centre', sev, days: 0, text, who: me?.name ?? 'You', when: 'Just now' }
      qc.setQueryData<AuditEntry[]>(key('audit'), (list) => [entry, ...(list ?? [])])
    },
    [qc]
  )
}

function useListWriter<T extends { id: string }>(k: readonly string[]) {
  const qc = useQueryClient()
  const set = useCallback((fn: (list: T[]) => T[]) => qc.setQueryData<T[]>(k, (list) => fn(list ?? [])), [qc, k])
  const patch = useCallback(
    (id: string, changes: Partial<T>): Undo => {
      let before: T | undefined
      set((list) => list.map((x) => (x.id === id ? ((before = x), { ...x, ...changes }) : x)))
      return () => set((list) => list.map((x) => (x.id === id && before ? before : x)))
    },
    [set]
  )
  return { set, patch }
}

export function useUnitActions() {
  const { set, patch } = useListWriter<Unit>(key('units'))
  const qc = useQueryClient()
  const log = useAuditLog()
  const units = () => qc.getQueryData<Unit[]>(key('units')) ?? []
  return {
    create: (u: Omit<Unit, 'id' | 'archived'>) => {
      const id = `u-${Date.now().toString(36)}`
      set((list) => [...list, { ...u, id, archived: false }])
      log('Admin units', `${u.name} created${u.parent ? ` under ${unitPath(units(), u.parent)}` : ''}`)
      return id
    },
    update: (id: string, changes: Partial<Unit>) => {
      const undo = patch(id, changes)
      const u = units().find((x) => x.id === id)
      if (u) log('Admin units', changes.name && changes.name !== u.name ? `${u.name} renamed to ${changes.name}` : `${u.name} updated`)
      return undo
    },
    archive: (id: string) => {
      const u = units().find((x) => x.id === id)
      const undo = patch(id, { archived: true })
      if (u) log('Admin units', `${u.name} archived`)
      return undo
    },
    recolor: (id: string, tone: Unit['tone']) => {
      const u = units().find((x) => x.id === id)
      patch(id, { tone })
      if (u) log('Admin units', tone ? `${u.name} recoloured` : `${u.name} colour reset`)
    },
    setLead: (id: string, leadId: string | undefined, leadName?: string) => {
      const u = units().find((x) => x.id === id)
      patch(id, { leadId })
      if (u) log('Admin units', leadId ? `${leadName ?? 'Someone'} set as lead of ${u.name}` : `${u.name} lead cleared`)
    },
    /** Moves a unit one place up or down among its siblings. */
    nudge: (id: string, dir: 1 | -1) => {
      const u = units().find((x) => x.id === id)
      if (!u) return
      const sibs = unitKids(units(), u.parent)
      const at = sibs.findIndex((x) => x.id === id), to = at + dir
      if (at < 0 || to < 0 || to >= sibs.length) return
      const next = [...sibs]
      next.splice(to, 0, next.splice(at, 1)[0])
      set((list) => list.map((x) => { const ix = next.findIndex((n) => n.id === x.id); return ix < 0 ? x : { ...x, order: ix } }))
    },
  }
}

export function usePersonActions() {
  const { set, patch } = useListWriter<Person>(key('people'))
  const qc = useQueryClient()
  const log = useAuditLog()
  const people = () => qc.getQueryData<Person[]>(key('people')) ?? []
  const notify = useNotify()
  const announce = (p: Person, what: 'added' | 'exited') =>
    notify('controlcentre.employee_changed', {
      title: `${p.name} ${what === 'added' ? 'joined' : 'exited'}`,
      meta: `${p.title} · ${unitPath(qc.getQueryData<Unit[]>(key('units')) ?? [], p.unitId)}`,
      category: 'Setup',
      to: { app: 'control-centre', section: 'employees', id: p.id },
      subject: { unitId: p.unitId },
    })
  const bumpEmployeeId = () =>
    qc.setQueryData<NumberingRule[]>(key('numbering'), (list) => (list ?? []).map((r) => (r.id === 'k-2' ? { ...r, next: nextCode(r.next) } : r)))
  return {
    /** The next employee ID the numbering rule will hand out. */
    nextId: () => qc.getQueryData<NumberingRule[]>(key('numbering'))?.find((r) => r.id === 'k-2')?.next ?? 'EMP-000',
    create: (p: Person) => {
      set((list) => [...list, p])
      bumpEmployeeId()
      log('Employees', `${p.name} added to ${unitPath(qc.getQueryData<Unit[]>(key('units')) ?? [], p.unitId)}`)
      announce(p, 'added')
    },
    update: (id: string, changes: Partial<Person>) => {
      const was = people().find((x) => x.id === id)
      const undo = patch(id, changes)
      if (was) {
        const renamed = changes.name !== undefined && changes.name !== was.name
        const exited = changes.status === 'Exited' && was.status !== 'Exited'
        log('Employees', renamed ? `${was.name} renamed to ${changes.name}` : `${was.name} updated${exited ? ', access revoked' : ''}`, exited ? 'high' : 'normal')
        if (exited) { const unnotify = announce({ ...was, ...changes }, 'exited'); return () => { undo(); unnotify() } }
      }
      return undo
    },
    exit: (id: string, perms: Person['perms']) => {
      const p = people().find((x) => x.id === id)
      const undo = patch(id, { status: 'Exited', end: p?.end || fmtDate(new Date()), primarySite: null, access: [], perms, role: 'Staff' })
      if (!p) return undo
      log('Employees', `${p.name} marked as exited, access revoked`, 'high')
      const unnotify = announce(p, 'exited')
      return () => { undo(); unnotify() }
    },
    /** One change across many people; the caller says what changed for the log. */
    bulk: (ids: string[], fn: (p: Person) => Person, what: string) => {
      set((list) => list.map((p) => (ids.includes(p.id) ? fn(p) : p)))
      log('Employees', `${ids.length} ${ids.length === 1 ? 'employee' : 'employees'} ${what}`)
    },
    importMany: (list: Person[]) => {
      set((cur) => [...cur, ...list])
      list.forEach(bumpEmployeeId)
      log('Employees', `${list.length} imported from CSV`)
    },
  }
}

export function useSiteTypeActions() {
  const { set, patch } = useListWriter<SiteType>(key('site-types'))
  const qc = useQueryClient()
  const log = useAuditLog()
  return {
    create: (t: Omit<SiteType, 'id'>) => {
      const id = `t-${Date.now().toString(36)}`
      set((list) => [...list, { ...t, id }])
      log('Site types', `${t.name} created`)
      return id
    },
    update: (id: string, changes: Partial<SiteType>, summary: string) => {
      const undo = patch(id, changes)
      log('Site types', summary, changes.mode !== undefined || changes.negative !== undefined ? 'high' : 'normal')
      return undo
    },
    /** Deletes a type, moving any site that used it onto `target`. */
    remove: (id: string, target: string | null) => {
      const t = (qc.getQueryData<SiteType[]>(key('site-types')) ?? []).find((x) => x.id === id)
      if (target) qc.setQueryData<Site[]>(key('sites'), (list) => (list ?? []).map((s) => (s.typeId === id ? { ...s, typeId: target } : s)))
      set((list) => list.filter((x) => x.id !== id))
      if (t) log('Site types', `${t.name} deleted`, 'high')
    },
  }
}

export function useSiteActions() {
  const { set, patch } = useListWriter<Site>(key('sites'))
  const qc = useQueryClient()
  const log = useAuditLog()
  const sites = () => qc.getQueryData<Site[]>(key('sites')) ?? []
  const notify = useNotify()
  return {
    create: (s: Omit<Site, 'id'>) => {
      const id = `s-${Date.now().toString(36)}`
      set((list) => [...list, { ...s, id }])
      log('Sites', `${s.name} created`)
      return id
    },
    update: (id: string, changes: Partial<Site>, summary?: string) => {
      const undo = patch(id, changes)
      const s = sites().find((x) => x.id === id)
      if (s) log('Sites', summary ?? `${s.name} details edited`)
      return undo
    },
    setStatus: (id: string, status: Site['status']) => {
      const s = sites().find((x) => x.id === id)
      const undo = patch(id, { status })
      if (!s || s.status === status) return undo
      log('Sites', status === 'Paused' ? `${s.name} paused — stock frozen` : `${s.name} reactivated`)
      const unnotify = notify('controlcentre.site_paused', {
        title: `${s.name} ${status === 'Paused' ? 'paused' : 'reactivated'}`,
        meta: status === 'Paused' ? `${s.code} · stock frozen` : `${s.code} · taking stock actions again`,
        category: 'Setup',
        to: { app: 'control-centre', section: 'sites', id: s.id },
        subject: { siteId: s.id },
      })
      return () => { undo(); unnotify() }
    },
    setBins: (id: string, aisles: number, per: number) => {
      const s = sites().find((x) => x.id === id)
      const undo = patch(id, { aisles, per, bins: aisles * per })
      if (s) log('Sites', aisles * per ? `${s.name} bin layout set to ${aisles} aisles × ${per}` : `${s.name} bins removed`)
      return undo
    },
    setDefault: (id: string) => {
      qc.setQueryData(key('default-site'), id)
      const s = sites().find((x) => x.id === id)
      if (s) log('Sites', `${s.name} marked as the default receiving site`)
    },
    importMany: (list: Site[]) => {
      set((cur) => [...cur, ...list])
      log('Sites', `${list.length} sites imported from CSV`)
    },
  }
}

/** Public holidays: Admins switch national days on or off, and add, edit and delete their own closures. */
export function useHolidayActions() {
  const { set, patch } = useListWriter<Holiday>(key('holidays'))
  const qc = useQueryClient()
  const log = useAuditLog()
  const find = (id: string) => (qc.getQueryData<Holiday[]>(key('holidays')) ?? []).find((h) => h.id === id)
  const notify = useNotify()
  /** Tells site managers about a closure, and warns the managers whose count falls due that day. */
  const announce = (h: Pick<Holiday, 'id' | 'name' | 'date' | 'appliesTo'>) => {
    const all = qc.getQueryData<Site[]>(key('sites')) ?? []
    const types = qc.getQueryData<SiteType[]>(key('site-types')) ?? []
    const undos = [
      notify('calendar.holiday_added', {
        title: `${h.name} is a holiday`,
        meta: `${fmtIsoDay(h.date)}${h.appliesTo.sites.length || h.appliesTo.units.length ? ' · some units and sites' : ' · everyone'}`,
        category: 'Setup',
        to: { app: 'control-centre', section: 'holidays', id: h.id },
        subject: { siteIds: h.appliesTo.sites },
      }),
    ]
    const scoped = h.appliesTo.sites.length ? all.filter((s) => h.appliesTo.sites.includes(s.id)) : h.appliesTo.units.length ? [] : all
    for (const s of scoped) {
      if (s.status !== 'Active' || !types.length || nextCountDue(s, siteTypeById(types, s.typeId), new Date()) !== h.date) continue
      undos.push(
        notify('inventory.count_due', {
          title: `${s.name} count falls on ${h.name}`,
          meta: `${fmtIsoDay(h.date)} · move the count or plan cover`,
          category: 'Stock',
          to: { app: 'control-centre', section: 'sites', id: s.id },
          subject: { siteId: s.id },
        })
      )
    }
    return () => undos.forEach((u) => u())
  }
  return {
    create: (h: Omit<Holiday, 'id' | 'origin' | 'on'>) => {
      const id = `h-${Date.now().toString(36)}`
      set((list) => [...list, { ...h, id, origin: 'custom', on: true }])
      log('Public holidays', `${h.name} added on ${h.date}`)
      announce({ ...h, id })
      return id
    },
    update: (id: string, changes: Partial<Holiday>) => {
      const h = find(id)
      const undo = patch(id, changes)
      if (h) log('Public holidays', changes.date && changes.date !== h.date ? `${h.name} moved to ${changes.date}` : `${h.name} updated`)
      return undo
    },
    toggle: (id: string) => {
      const h = find(id)
      if (!h) return
      patch(id, { on: !h.on })
      log('Public holidays', `${h.name} switched ${h.on ? 'off' : 'on'}`)
      if (!h.on) announce(h)
    },
    remove: (id: string): Undo => {
      const h = find(id)
      let before: Holiday[] = []
      set((list) => ((before = list), list.filter((x) => x.id !== id)))
      if (h) log('Public holidays', `${h.name} removed`, 'high')
      return () => set(() => before)
    },
  }
}

/** Approval chains are Admin-only. A chain an app still points at cannot be deleted. */
export function useApprovalChainActions() {
  const { set, patch } = useListWriter<ApprovalChain>(key('approval-chains'))
  const qc = useQueryClient()
  const log = useAuditLog()
  const find = (id: string) => (qc.getQueryData<ApprovalChain[]>(key('approval-chains')) ?? []).find((c) => c.id === id)
  return {
    create: (c: Omit<ApprovalChain, 'id' | 'used'>) => {
      const id = `c-${Date.now().toString(36)}`
      set((list) => [...list, { ...c, id, used: [] }])
      log('Approvals', `${c.name} created`)
      return id
    },
    update: (id: string, changes: Partial<ApprovalChain>) => {
      const c = find(id)
      const undo = patch(id, changes)
      if (c) log('Approvals', `${changes.name ?? c.name} updated`, changes.threshold && changes.threshold !== c.threshold ? 'high' : 'normal')
      return undo
    },
    remove: (id: string): Undo => {
      const c = find(id)
      let before: ApprovalChain[] = []
      set((list) => ((before = list), list.filter((x) => x.id !== id)))
      if (c) log('Approvals', `${c.name} deleted`, 'high')
      return () => set(() => before)
    },
  }
}

export function useNotificationRuleActions() {
  const { patch } = useListWriter<NotificationRule>(key('notification-rules'))
  const qc = useQueryClient()
  const log = useAuditLog()
  return {
    toggle: (id: string, channel: 'inApp' | 'email') => {
      const r = (qc.getQueryData<NotificationRule[]>(key('notification-rules')) ?? []).find((x) => x.id === id)
      if (!r) return
      patch(id, { [channel]: !r[channel] })
      log('Notifications', `${r.event} · ${channel === 'inApp' ? 'in-app' : 'email'} turned ${r[channel] ? 'off' : 'on'}`)
    },
  }
}

export function useNumberingActions() {
  const { patch } = useListWriter<NumberingRule>(key('numbering'))
  const log = useAuditLog()
  return {
    update: (rule: NumberingRule, changes: Pick<NumberingRule, 'pattern' | 'next'>) => {
      const undo = patch(rule.id, changes)
      log('Codes', `${rule.label} pattern set to ${changes.pattern}`, 'high')
      return undo
    },
  }
}

/** Countries switch on and off; regions Bool surveyed stay as shipped, custom ones are editable. */
export function useRegionActions() {
  const regions = useListWriter<Region>(key('regions'))
  const countries = useListWriter<Country>(key('countries'))
  const qc = useQueryClient()
  const log = useAuditLog()
  return {
    toggleCountry: (id: string) => {
      const c = (qc.getQueryData<Country[]>(key('countries')) ?? []).find((x) => x.id === id)
      if (!c) return
      countries.patch(id, { on: !c.on })
      log('Regions', `${c.name} turned ${c.on ? 'off' : 'on'}`)
    },
    create: (r: Omit<Region, 'id' | 'origin'>) => {
      const id = `g-${Date.now().toString(36)}`
      regions.set((list) => [...list, { ...r, id, origin: 'custom' }])
      log('Regions', `${r.name} added · ${r.places.length} ${r.places.length === 1 ? 'place' : 'places'}`)
      return id
    },
    update: (id: string, changes: Partial<Region>) => {
      const r = (qc.getQueryData<Region[]>(key('regions')) ?? []).find((x) => x.id === id)
      const undo = regions.patch(id, changes)
      // sites carry the region by name, so a rename follows through to them
      if (r && changes.name && changes.name !== r.name) qc.setQueryData<Site[]>(key('sites'), (list) => (list ?? []).map((s) => (s.region === r.name && s.country === r.country ? { ...s, region: changes.name ?? s.region } : s)))
      if (r) log('Regions', `${changes.name ?? r.name} updated`)
      return undo
    },
    remove: (id: string): Undo => {
      const r = (qc.getQueryData<Region[]>(key('regions')) ?? []).find((x) => x.id === id)
      let before: Region[] = []
      regions.set((list) => ((before = list), list.filter((x) => x.id !== id)))
      if (r) log('Regions', `${r.name} deleted`)
      return () => regions.set(() => before)
    },
  }
}
