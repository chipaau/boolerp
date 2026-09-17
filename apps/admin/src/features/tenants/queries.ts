// The tenants data seam. The list and lifecycle transitions call the real Go API; the design-only
// profile (plan, seats, hierarchy, apps, admins, activity…) is fixture-backed until the SRS and data
// model cover it. Fixture mutations update the cache in place and return an undo.
import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import { api } from '@/lib/api'
import { fromApiStatus, fromDesignStatus } from './logic'
import * as mock from './mock'
import type {
  ActivityEvent,
  AppName,
  CreateTenantInput,
  CreateTenantResult,
  DesignStatus,
  DirectoryTenant,
  PlanName,
  Tenant,
  TenantAdmin,
  TenantApps,
  TenantProfile,
  Undo,
} from './types'

const key = (...parts: string[]) => ['admin', 'tenants', ...parts] as const

// ---------------------------------------------------------------------------------------------
// Real API (unchanged contract)
// ---------------------------------------------------------------------------------------------

export function useTenants() {
  return useQuery({ queryKey: key('list'), queryFn: () => api.get<Tenant[]>('/api/v1/admin/tenants') })
}

export function useCreateTenant() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateTenantInput) => api.post<CreateTenantResult>('/api/v1/admin/tenants', input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: key('list') }),
  })
}

type TransitionAction = 'suspend' | 'reactivate' | 'archive'

function useTransition(action: TransitionAction) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.post<Tenant>(`/api/v1/admin/tenants/${id}/${action}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: key('list') }),
  })
}

export const useSuspendTenant = () => useTransition('suspend')
export const useReactivateTenant = () => useTransition('reactivate')
export const useArchiveTenant = () => useTransition('archive')

// ---------------------------------------------------------------------------------------------
// Fixture-backed catalogue + profiles. `initialData` means these never suspend or load.
// ---------------------------------------------------------------------------------------------

const fixture = <T>(k: readonly string[], data: T) =>
  queryOptions({ queryKey: k, queryFn: async () => data, initialData: data, staleTime: Infinity })

export const plansQuery = () => fixture(key('plans'), mock.PLANS)
export const appCatalogQuery = () => fixture(key('apps'), mock.APP_CATALOG)
export const profilesQuery = () => fixture(key('profiles'), mock.TENANT_PROFILES)

export const usePlans = () => useQuery(plansQuery()).data ?? mock.PLANS
export const useAppCatalog = () => useQuery(appCatalogQuery()).data ?? mock.APP_CATALOG
/** Apps included with every tenant; they cannot be toggled off. */
export const useCoreApps = () => mock.CORE_APPS
export const useOrgTypes = () => mock.ORG_TYPES
export const useEntityTypes = () => mock.ENTITY_TYPES

/** Raw fixture profiles (design seed + anything created/edited this session). */
export const useTenantProfiles = () => useQuery(profilesQuery()).data ?? mock.TENANT_PROFILES
/** One fixture profile by slug, or undefined. Prefer `useDirectoryTenant` for screens. */
export const useTenantProfile = (slug: string) => useTenantProfiles().find((p) => p.slug === slug)

/** Sensible design-field defaults for an API tenant that has no fixture profile. */
function defaultProfile(t: Tenant): TenantProfile {
  const created = new Date(t.created_at)
  const when = Number.isNaN(created.getTime())
    ? '—'
    : created.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  return {
    slug: t.slug, name: t.name, abbr: t.code.toUpperCase(), regNo: '—', orgType: 'Not set', entityType: 'Not set',
    parentSlug: null, plan: 'Starter', seatsUsed: 0, seatLimit: 40, status: 'Active',
    activeFrom: t.status === 'active' ? when : '—', contact: '—', email: '—', country: t.country || '—', district: '—',
    addr: '—', mail: '—', apps: { 'Control Centre': ['Settings'] }, admins: [],
    activity: [{ when, what: 'Tenant provisioned', who: 'System' }],
  }
}

export type TenantDirectory = {
  /** API tenants (merged with a profile when the slug matches) + fixture-only tenants. Fixture order first, API-only appended. */
  tenants: DirectoryTenant[]
  isLoading: boolean
  error: Error | null
}

/**
 * The tenant list every screen should use. Merges `useTenants()` with fixture profiles by slug:
 * API name/code/country/status win; design fields come from the profile or defaults.
 * While the API loads (or if it errors) fixture tenants still render.
 */
export function useTenantDirectory(): TenantDirectory {
  const list = useTenants()
  const profiles = useTenantProfiles()
  const tenants = useMemo(() => {
    const rows = list.data ?? []
    const bySlug = new Map(rows.map((t) => [t.slug, t]))
    const out: DirectoryTenant[] = profiles.map((p) => {
      const t = bySlug.get(p.slug)
      if (!t) return { ...p, apiId: null, source: 'fixture', directoryStatus: fromDesignStatus(p.status), createdAt: null, hasProfile: true }
      return { ...p, name: t.name, country: t.country || p.country, apiId: t.id, source: 'api', directoryStatus: fromApiStatus(t.status), createdAt: t.created_at, hasProfile: true }
    })
    const known = new Set(profiles.map((p) => p.slug))
    for (const t of rows) {
      if (known.has(t.slug)) continue
      out.push({ ...defaultProfile(t), apiId: t.id, source: 'api', directoryStatus: fromApiStatus(t.status), createdAt: t.created_at, hasProfile: false })
    }
    return out
  }, [list.data, profiles])
  return { tenants, isLoading: list.isLoading, error: list.error }
}

/** One directory tenant by slug (undefined while unknown). */
export const useDirectoryTenant = (slug: string) => useTenantDirectory().tenants.find((t) => t.slug === slug)

// ---------------------------------------------------------------------------------------------
// Fixture mutations (design actions the API lacks). Each returns an undo.
// For an API tenant without a profile, the first edit seeds one from `seed` (pass the DirectoryTenant).
// ---------------------------------------------------------------------------------------------

export function useTenantProfileActions() {
  const qc = useQueryClient()
  const set = useCallback((fn: (list: TenantProfile[]) => TenantProfile[]) => qc.setQueryData<TenantProfile[]>(key('profiles'), (l) => fn(l ?? [])), [qc])

  const change = useCallback(
    (slug: string, fn: (p: TenantProfile) => TenantProfile, seed?: TenantProfile, log?: string): Undo => {
      let before: TenantProfile[] = []
      set((list) => {
        before = list
        const base = list.find((p) => p.slug === slug) ?? (seed ? stripDirectory(seed) : undefined)
        if (!base) return list
        let next = fn(base)
        if (log) next = { ...next, activity: [event(log), ...next.activity] }
        return list.some((p) => p.slug === slug) ? list.map((p) => (p.slug === slug ? next : p)) : [...list, next]
      })
      return () => set(() => before)
    },
    [set]
  )

  return {
    /** Adds a profile (wizard "Create and activate" / "Save as pending" / "Save draft"). */
    create: (profile: TenantProfile): Undo => {
      let before: TenantProfile[] = []
      set((list) => ((before = list), [...list.filter((p) => p.slug !== profile.slug), profile]))
      return () => set(() => before)
    },
    /** Shallow patch of any profile field (identity, address, contact…). */
    update: (slug: string, changes: Partial<Omit<TenantProfile, 'slug'>>, seed?: TenantProfile) => change(slug, (p) => ({ ...p, ...changes }), seed),
    /** "Plan & seats" drawer. Logs an activity line. */
    setPlan: (slug: string, plan: PlanName, seatLimit: number, seed?: TenantProfile) =>
      change(slug, (p) => ({ ...p, plan, seatLimit }), seed, `Plan set to ${plan} with ${seatLimit} seats`),
    /** "Parent tenant" drawer; null = standalone. Caller must block when the tenant has children. */
    setParent: (slug: string, parentSlug: string | null, seed?: TenantProfile) =>
      change(slug, (p) => ({ ...p, parentSlug }), seed, parentSlug ? `Moved under ${parentSlug.toUpperCase()}` : 'Made standalone'),
    /** Fixture-only tenants: suspend / lift suspension / activate. API tenants use the API hooks. */
    setStatus: (slug: string, status: DesignStatus) =>
      change(slug, (p) => ({ ...p, status }), undefined, status === 'Suspended' ? 'Tenant suspended — all sign-ins blocked' : `Status set to ${status}`),
    setApps: (slug: string, apps: TenantApps, seed?: TenantProfile) =>
      change(slug, (p) => ({ ...p, apps: { ...apps, 'Control Centre': ['Settings'] } }), seed),
    /** Toggles one app on (with its first module) or off. Core apps (Control Centre, Calendar) cannot be turned off. */
    toggleApp: (slug: string, app: AppName, seed?: TenantProfile) =>
      change(slug, (p) => {
        if (mock.CORE_APPS.includes(app)) return p
        const apps = { ...p.apps }
        if (apps[app]) delete apps[app]
        else apps[app] = (mock.APP_CATALOG.find((a) => a.name === app)?.modules ?? []).slice(0, 1)
        return { ...p, apps }
      }, seed),
    /** Toggles a module; an enabled app keeps at least one module. */
    toggleModule: (slug: string, app: AppName, module: string, seed?: TenantProfile) =>
      change(slug, (p) => {
        const list = p.apps[app]
        if (!list || app === 'Control Centre') return p
        const next = list.includes(module) ? (list.length > 1 ? list.filter((m) => m !== module) : list) : [...list, module]
        return { ...p, apps: { ...p.apps, [app]: next } }
      }, seed),
    addAdmin: (slug: string, admin: Omit<TenantAdmin, 'invite' | 'last'>, seed?: TenantProfile) =>
      change(slug, (p) => ({ ...p, admins: [...p.admins, { ...admin, invite: 'Invited', last: 'Invited just now' }] }), seed, `${admin.name} invited as tenant admin`),
    /** Design blocks removing the last admin — check `admins.length > 1` first. */
    removeAdmin: (slug: string, idNo: string) =>
      change(slug, (p) => ({ ...p, admins: p.admins.filter((a) => a.idNo !== idNo) }), undefined, `Admin ${idNo} removed`),
    /** Sets the invite back to Invited. */
    resendInvite: (slug: string, idNo: string) =>
      change(slug, (p) => ({ ...p, admins: p.admins.map((a) => (a.idNo === idNo ? { ...a, invite: 'Invited', last: 'Invited just now' } : a)) })),
    /** Re-sends every non-accepted invite; returns undo. */
    resendPendingInvites: (slug: string) =>
      change(slug, (p) => ({ ...p, admins: p.admins.map((a) => (a.invite === 'Accepted' ? a : { ...a, invite: 'Invited', last: 'Invited just now' })) })),
  }
}

function event(what: string): ActivityEvent {
  return { when: mock.TODAY, what, who: mock.CURRENT_OPERATOR }
}

/** Accepts a DirectoryTenant as a seed and keeps only TenantProfile fields. */
function stripDirectory(t: TenantProfile): TenantProfile {
  const copy: Partial<DirectoryTenant> = { ...t }
  delete copy.apiId
  delete copy.source
  delete copy.directoryStatus
  delete copy.createdAt
  delete copy.hasProfile
  return copy as TenantProfile
}
