// ---------------------------------------------------------------------------------------------
// Real API shapes. Mirrors httpapi.tenantResponse (apps/api/internal/httpapi/admin_tenants.go).
// ---------------------------------------------------------------------------------------------
export type TenantStatus = 'provisioning' | 'active' | 'suspended' | 'archived'

export type Tenant = {
  id: string
  slug: string
  code: string
  name: string
  country: string
  status: TenantStatus
  created_at: string
}

export type CreateTenantInput = {
  slug: string
  code: string
  name: string
  country: string
  party_type_code: string
  institution_type_code: string
  owner_email: string
  owner_name: string
}

export type CreateTenantResult = {
  tenant: Tenant
  recovery_link: string
}

// ---------------------------------------------------------------------------------------------
// Design-only profile (Bool Admin design). UI fixtures — shapes pending SRS/data-model review.
// Keyed by tenant slug. Dates are display strings ('25 Oct 2024'), '—' means not set.
// ---------------------------------------------------------------------------------------------
export type Undo = () => void

export type PlanName = 'Starter' | 'Basic' | 'Pro' | 'Enterprise'

export type Plan = {
  name: PlanName
  /** Seats included / default seat limit. */
  seats: number
  /** Monthly base price, MVR. */
  base: number
  /** Monthly price per seat in use, MVR. */
  perSeat: number
  note: string
}

export type AppName = 'Inventory Management' | 'Directory' | 'Calendar' | 'Scan' | 'Control Centre'

export type AppDef = { name: AppName; note: string; modules: string[] }

/** Enabled apps → enabled module names. 'Control Centre' is always present. */
export type TenantApps = Partial<Record<AppName, string[]>>

export type OrgType = 'Government' | 'Local government' | 'Public company' | 'Private company' | 'NGO' | 'International'

export type EntityType =
  | 'Ministry'
  | 'Statutory body'
  | 'Council'
  | 'Hospital'
  | 'School'
  | 'Education'
  | 'Transport'
  | 'Telecom'
  | 'Other'

export type InviteState = 'Accepted' | 'Invited' | 'Expired'

export type Nationality = 'Maldivian' | 'Expatriate'

/** A person who runs one tenant day to day. `idNo` is a national ID or passport number and is the key. */
export type TenantAdmin = { name: string; idNo: string; email: string; invite: InviteState; last: string }

export type ActivityEvent = { when: string; what: string; who: string }

/** Lifecycle as the design names it. API tenants map onto it via `DirectoryStatus`. */
export type DesignStatus = 'Active' | 'Suspended' | 'Pending activation' | 'Draft'

export type TenantProfile = {
  slug: string
  name: string
  abbr: string
  regNo: string
  orgType: OrgType | 'Not set'
  entityType: EntityType | 'Not set'
  parentSlug: string | null
  plan: PlanName
  seatsUsed: number
  seatLimit: number
  /** Only used for fixture-only tenants; API tenants take their status from the API. */
  status: DesignStatus
  activeFrom: string
  contact: string
  email: string
  country: string
  district: string
  addr: string
  /** Mailing address; starts with 'Same as' when mirrored. */
  mail: string
  apps: TenantApps
  admins: TenantAdmin[]
  /** Newest first. */
  activity: ActivityEvent[]
}

/** Unified status across API + fixture tenants. Filter chips map: Active, Pending activation (pending|provisioning), Suspended, Draft. */
export type DirectoryStatus = 'active' | 'suspended' | 'archived' | 'provisioning' | 'pending' | 'draft'

/** One row of the tenant directory: API tenant merged with its profile, or a fixture-only tenant. */
export type DirectoryTenant = TenantProfile & {
  /** Real API id; null for fixture-only tenants (they cannot use the suspend/reactivate/archive API hooks). */
  apiId: string | null
  source: 'api' | 'fixture'
  directoryStatus: DirectoryStatus
  /** ISO timestamp from the API, null for fixtures. */
  createdAt: string | null
  /** False when an API tenant has no fixture profile and the design fields are defaults. */
  hasProfile: boolean
}
