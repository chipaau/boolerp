// The organisation record every other app reads: admin units, people, sites and site types.
// Control Centre writes it; Directory, Calendar, Inventory and Scan read it. Mirrors what the
// API will return; once `packages/api-client` is generated these become re-exports.
import type { BadgeTone } from '@workspace/ui/components/badge'

export type Tone = BadgeTone

// ---- units (the org tree: divisions, departments, teams — any depth)
export type UnitKind = 'Division' | 'Department' | 'Team'
export type Unit = {
  id: string
  name: string
  parent: string | null
  code: string
  kind: UnitKind
  /** Colour used for the unit and, unless they set their own, everything under it. */
  tone?: Tone
  /** A chosen lead; otherwise the most senior member stands in. */
  leadId?: string
  /** Position among siblings; unset means fixture order. */
  order?: number
  archived: boolean
}

// ---- people
export type PersonStatus = 'Not started' | 'Active' | 'On leave' | 'Exited'
export type Contract = 'Full-time' | 'Part-time' | 'Contract' | 'Intern'
/** The one-word label lists show, derived from the app roles — never picked directly. */
export type PersonRole = 'Staff' | 'Manager' | 'Admin'
export type AppKey = 'Inventory' | 'Calendar' | 'Directory' | 'Scan'
/** One role per app; each app owns its own set (see APP_ROLES in logic.ts). */
export type Perms = Record<AppKey, string>
export type Away = { from: string; to: string; type: string }
export type Person = {
  /** The employee ID (EMP-###) doubles as the record id; external contacts are EXT-###. */
  id: string
  name: string
  title: string
  /** External contacts (a client's people) have no unit and sit outside the org tree. */
  unitId: string | null
  managerId: string | null
  status: PersonStatus
  /** "12 Mar 2018" style, as the record shows it. */
  start: string
  end: string
  contract: Contract
  role: PersonRole
  primarySite: string | null
  /** Storage sites where Inventory and Scan accept stock actions from them. */
  access: string[]
  phone: string
  email: string
  chat: string
  photo?: string
  perms: Perms
  badge?: string
  away?: Away
  emergency?: { name: string; relationship: string; phone: string }
  external?: boolean
}

// ---- sites and site types
export type StorageMode = 'None' | 'Transit' | 'Storage'
export type Cadence = 'None' | 'Weekly' | 'Monthly' | 'Quarterly'
export type SiteType = {
  id: string
  name: string
  mode: StorageMode
  desc: string
  issue: boolean
  bins: boolean
  negative: boolean
  cadence: Cadence
}
export type SiteStatus = 'Active' | 'Paused'
export type Site = {
  id: string
  name: string
  code: string
  typeId: string
  parent: string | null
  country: string
  region: string
  place: string
  addr: string
  ownerId: string | null
  status: SiteStatus
  opened: string
  bins: number
  aisles: number
  per: number
  lines: number
  value: string
  counted: string
  util: number
  /** A site's own counting policy; null follows its type. */
  cadence: Cadence | null
}

// ---- geography (countries Hexa ships; regions and places inside them)
export type Country = { id: string; name: string; code: string; tz: string; cur: string; seeded: boolean; on: boolean }
export type Region = { id: string; country: string; name: string; origin: 'system' | 'custom'; places: string[] }

/**
 * A day the organisation is closed. Hexa keeps the Maldives public holidays current (`origin:
 * 'system'`, which an Admin can only switch off); Admins add their own (`'custom'`). `appliesTo`
 * narrows a day to admin units (a unit covers its sub-units) and/or sites; both empty = everyone.
 */
export type Holiday = {
  id: string
  name: string
  nameDv: string
  /** Local ISO day, YYYY-MM-DD. */
  date: string
  halfDay: boolean
  origin: 'system' | 'custom'
  on: boolean
  appliesTo: { units: string[]; sites: string[] }
}

// ---- system
/**
 * Who signs off, in what order, above what value. Apps point at a chain by id; Control Centre
 * owns who signs. A step is a role that resolves live ('Site manager', 'Unit lead', a job title)
 * or a person id.
 */
export type ApprovalChain = {
  id: string
  name: string
  /** 'Any' for every request, otherwise a money text such as 'MVR 30,000'. */
  threshold: string
  steps: string[]
  /** The app processes pointing at this chain, e.g. 'Inventory · stock write-offs'. */
  used: string[]
  standIn?: string
  /** Local ISO day the stand-in covers until. */
  standInUntil?: string
}
/** One event an app raises, who it reaches (resolved live through the org tree) and on which channels. */
export type NotificationRule = { id: string; sourceApp: string; event: string; recipients: string; inApp: boolean; email: boolean }
export type NumberingRule = { id: string; app: string; label: string; pattern: string; next: string; note: string }
export type AuditEntry = {
  id: string
  scope: string
  app: string
  sev: 'normal' | 'high'
  /** Days ago, for the "last n days" filter. */
  days: number
  text: string
  who: string
  when: string
}

/** The signed-in person as the org knows them. */
export type Me = { id: string; role: PersonRole }
