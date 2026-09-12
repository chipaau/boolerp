// Pure helpers over the org record. No React, no fixtures: components and queries call these.
import type { AppKey, Cadence, Perms, Person, PersonRole, PersonStatus, Site, SiteType, StorageMode, Tone, Unit } from './types'

// ---------- units
export const UNIT_KINDS: Unit['kind'][] = ['Division', 'Department', 'Team']

export const liveUnits = (units: Unit[]) => units.filter((u) => !u.archived)
export const unitById = (units: Unit[], id: string | null | undefined) => (id ? units.find((u) => u.id === id && !u.archived) : undefined)
export const unitKids = (units: Unit[], parent: string | null) =>
  liveUnits(units).map((u, i) => ({ u, i })).filter(({ u }) => u.parent === parent).sort((a, b) => (a.u.order ?? a.i) - (b.u.order ?? b.i)).map(({ u }) => u)
export function unitDescendants(units: Unit[], id: string): Unit[] {
  const out: Unit[] = []
  const walk = (p: string) => unitKids(units, p).forEach((k) => { out.push(k); walk(k.id) })
  walk(id)
  return out
}
/** Root-first chain of units from the top down to `id`. */
export function unitChain(units: Unit[], id: string | null): Unit[] {
  const out: Unit[] = []
  let cur = unitById(units, id)
  while (cur) { out.unshift(cur); cur = unitById(units, cur.parent) }
  return out
}
export const unitPath = (units: Unit[], id: string | null, sep = ' · ') => unitChain(units, id).map((u) => u.name).join(sep) || '—'
export const rootOf = (units: Unit[], id: string | null) => unitChain(units, id).at(0)
export const unitDepth = (units: Unit[], id: string) => Math.max(0, unitChain(units, id).length - 1)

const ROOT_TONES: Tone[] = ['success', 'plum', 'slate', 'tan', 'warning', 'neutral', 'rose']
/** A unit's colour: its own, else the nearest ancestor's, else one per top-level unit in order. */
export function unitTone(units: Unit[], id: string | null): Tone {
  const chain = unitChain(units, id)
  for (let i = chain.length - 1; i >= 0; i--) {
    const t = chain[i].tone
    if (t) return t
  }
  const roots = unitKids(units, null)
  const ix = roots.findIndex((r) => r.id === chain.at(0)?.id)
  return ROOT_TONES[(ix < 0 ? 0 : ix) % ROOT_TONES.length]
}

// ---------- people
export const isInternal = (p: Person) => !p.external
export const isOnBooks = (p: Person) => isInternal(p) && p.status !== 'Exited'
export const personById = (people: Person[], id: string | null | undefined) => (id ? people.find((p) => p.id === id) : undefined)
export const directReports = (people: Person[], id: string) => people.filter((p) => p.managerId === id && isOnBooks(p))
/** People sitting in a unit (or, deep, anywhere under it), leaving out those who have exited. */
export function unitMembers(people: Person[], units: Unit[], id: string, deep: boolean) {
  const ids = deep ? [id, ...unitDescendants(units, id).map((u) => u.id)] : [id]
  return people.filter((p) => isOnBooks(p) && p.unitId !== null && ids.includes(p.unitId))
}
const ROLE_ORDER: Record<PersonRole, number> = { Admin: 0, Manager: 1, Staff: 2 }
/** The unit's lead: the chosen one, else the most senior member (most reports breaks ties). */
export function unitLead(units: Unit[], people: Person[], id: string): Person | undefined {
  const u = unitById(units, id)
  const chosen = personById(people, u?.leadId)
  if (chosen && isOnBooks(chosen)) return chosen
  const direct = unitMembers(people, units, id, false)
  const pool = direct.length ? direct : unitMembers(people, units, id, true)
  return [...pool].sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || directReports(people, b.id).length - directReports(people, a.id).length || a.name.localeCompare(b.name)).at(0)
}

export function slugMail(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase())
    .slice(0, 2)
    .join('.') + '@hexa.co'
}
export const chatHandle = (name: string) => '@' + slugMail(name).split('@')[0]
export const ascii = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// ---- app roles: every app owns its own ladder; the person-level word is derived from them
export const APP_KEYS: AppKey[] = ['Inventory', 'Calendar', 'Directory', 'Scan']
/** [role, what it grants, rank used only to derive the person-level word] */
export const APP_ROLES: Record<AppKey, [string, string, number][]> = {
  Inventory: [
    ['None', 'Inventory never appears for them.', 0],
    ['Viewer', 'Reads stock levels, movements and reports. Changes nothing.', 1],
    ['Stock operator', 'Receives, issues and moves stock at their storage sites.', 2],
    ['Counter', 'Runs cycle counts and submits variances. Cannot issue stock.', 2],
    ['Site manager', 'Operator rights plus bins, write-offs and the first approval step.', 3],
    ['Inventory admin', "Item master, valuation rules and everyone's stock access.", 4],
  ],
  Calendar: [
    ['None', 'Calendar never appears for them.', 0],
    ['Viewer', 'Sees rosters, closures and counting dates for their sites.', 1],
    ['Scheduler', 'Builds shifts and counting schedules at their sites.', 2],
    ['Approver', 'Schedules, plus approves leave and shift swaps in their unit.', 3],
    ['Calendar admin', "Owns closures, holidays and every site's roster.", 4],
  ],
  Directory: [
    ['None', 'Directory never appears for them.', 0],
    ['Viewer', 'Browses people, units and site contacts.', 1],
    ['Editor', 'Keeps contact details current for their own unit.', 2],
    ['Directory admin', 'Edits any record and the tree Directory shows.', 4],
  ],
  Scan: [
    ['None', 'Scan never appears for them.', 0],
    ['Scanner', 'Scans goods in and out at their storage sites.', 2],
    ['Session lead', "Scans, plus corrects other people's sessions and reprints labels.", 3],
    ['Scan admin', "Device pairing, session rules and everyone's scanning access.", 4],
  ],
}
export const APP_GOVERNS: Record<AppKey, string> = {
  Inventory: 'Counts, receipts, issues and write-offs',
  Calendar: 'Shifts, counting schedules and closures',
  Directory: 'Browsing people, units and site contacts',
  Scan: 'Handheld scanning at reachable sites',
}
export const appRoleRank = (app: AppKey, role: string) => APP_ROLES[app].find((r) => r[0] === role)?.[2] ?? 0
export const appRoleNote = (app: AppKey, role: string) => APP_ROLES[app].find((r) => r[0] === role)?.[1] ?? ''
export function deriveRole(perms: Perms): PersonRole {
  const top = Math.max(0, ...APP_KEYS.map((a) => appRoleRank(a, perms[a])))
  return top >= 4 ? 'Admin' : top >= 3 ? 'Manager' : 'Staff'
}
/** Starting points only: used to seed people and bulk changes, never shown as a picker. */
export const ROLE_TEMPLATE: Record<PersonRole, Perms> = {
  Staff: { Inventory: 'Stock operator', Calendar: 'Viewer', Directory: 'Viewer', Scan: 'Scanner' },
  Manager: { Inventory: 'Site manager', Calendar: 'Approver', Directory: 'Viewer', Scan: 'Session lead' },
  Admin: { Inventory: 'Inventory admin', Calendar: 'Calendar admin', Directory: 'Directory admin', Scan: 'Scan admin' },
}
export const NO_STOCK_PERMS: Perms = { ...ROLE_TEMPLATE.Staff, Inventory: 'None', Scan: 'None' }
export const appsOn = (perms: Perms) => APP_KEYS.filter((a) => perms[a] !== 'None')

export const STATUS_TONE: Record<PersonStatus, Tone> = { Active: 'success', 'On leave': 'warning', 'Not started': 'warning', Exited: 'neutral' }
export const ROLE_TONE: Record<PersonRole, Tone> = { Admin: 'warning', Manager: 'success', Staff: 'neutral' }

// ---- dates: the record keeps "12 Mar 2018" strings, as people write them
export function parseDate(s: string): Date | null {
  if (!s.trim()) return null
  const d = new Date(Date.parse(s))
  return Number.isNaN(d.getTime()) ? null : d
}
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const fmtDay = (d: Date) => `${d.getDate()} ${MON[d.getMonth()]}`
export const fmtDate = (d: Date) => `${fmtDay(d)} ${d.getFullYear()}`
export function tenure(start: string, today: Date) {
  const d = parseDate(start)
  if (!d) return '—'
  const m = (today.getFullYear() - d.getFullYear()) * 12 + (today.getMonth() - d.getMonth())
  if (m < 0) return 'Soon'
  const y = Math.floor(m / 12), r = m % 12
  return y ? `${y}y ${r}m` : `${r}m`
}
/** Whether someone is away now (or within three weeks), with the short and long labels the lists use. */
export function awayInfo(p: Person, today: Date): { now: boolean; short: string; long: string } | null {
  if (p.status === 'On leave') return { now: true, short: 'On leave', long: 'On leave' }
  if (!p.away) return null
  const from = parseDate(p.away.from), to = parseDate(p.away.to)
  if (!from || !to) return null
  const t0 = new Date(today.toDateString())
  const long = `${p.away.type} · ${fmtDay(from)} – ${fmtDay(to)}`
  if (t0 >= from && t0 <= to) {
    const back = new Date(to.getTime() + 86400000)
    return { now: true, short: to.getTime() === from.getTime() ? 'Away today' : `Back ${fmtDay(back)}`, long }
  }
  const days = Math.round((from.getTime() - t0.getTime()) / 86400000)
  if (days > 0 && days <= 21) return { now: false, short: `Away ${fmtDay(from)}`, long }
  return null
}

// ---------- sites
export const MODES: { k: StorageMode; label: string; hint: string }[] = [
  { k: 'None', label: 'Not stored — consumed on arrival', hint: 'Goods delivered here are booked out immediately. Nothing is counted, issued or replenished. Use for job and project sites.' },
  { k: 'Transit', label: 'In transit — passing through', hint: 'Stock rests here only while it moves between sites. Visible as in-transit, never counted as on-hand.' },
  { k: 'Storage', label: 'Stored — held and counted', hint: 'Stock is held here, appears in stock takes, and can be replenished and issued.' },
]
export const modeHint = (m: StorageMode) => MODES.find((x) => x.k === m)?.hint ?? ''
export const modeLabel = (m: StorageMode) => MODES.find((x) => x.k === m)?.label ?? m
export const MODE_TONE: Record<StorageMode, Tone> = { None: 'neutral', Transit: 'warning', Storage: 'success' }
export const CADENCES: Cadence[] = ['None', 'Weekly', 'Monthly', 'Quarterly']
export const siteTypeById = (types: SiteType[], id: string) => types.find((t) => t.id === id) ?? types[0]
export const siteById = (sites: Site[], id: string | null | undefined) => (id ? sites.find((s) => s.id === id) : undefined)
export const siteLabel = (site: Site) => `${site.place} · ${site.region}`
/** Counting policy: the type sets the default, a site may override it. */
export function cadenceOf(site: Site, type: SiteType) {
  return { value: site.cadence ?? type.cadence, inherited: site.cadence === null, typeValue: type.cadence }
}
/** People who can act on stock at a site: based there, or granted it as a storage site. */
export const siteStaff = (people: Person[], siteId: string) => people.filter((p) => isOnBooks(p) && (p.primarySite === siteId || p.access.includes(siteId)))
const LET = 'ABCDEFGHIJKL'
export const binCode = (aisle: number, pos: number) => `${LET[aisle] ?? '?'}-${String(pos + 1).padStart(2, '0')}`
/** Deterministic fill levels for a site's bins, so the sample reads the same every time. */
export function binFills(site: Site): number[] {
  const n = site.bins, util = site.lines ? site.util : 0
  let seed = 0
  for (let i = 0; i < site.id.length; i++) seed += site.id.charCodeAt(i) * (i + 3)
  return Array.from({ length: n }, (_, i) => {
    const x = ((seed * 9301 + 49297 * (i + 1)) % 233280) / 233280
    return util ? Math.max(0, Math.min(100, Math.round(util * (0.55 + 0.9 * x)))) : 0
  })
}
export const nextCode = (pattern: string) => {
  const m = /^(.*?)(\d+)$/.exec(pattern)
  return m ? m[1] + String(Number(m[2]) + 1).padStart(m[2].length, '0') : pattern
}
