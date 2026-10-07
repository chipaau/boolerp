// The design prototype's tenants, fixtures only (C184/F2f). It used to call the Go API here for the
// list, creation and the lifecycle transitions; those moved to features/tenants/api.ts, the one place
// the tenants calls live, and the prototype keeps only its design-only profile (plan, seats,
// hierarchy, apps, admins, activity…). Fixture mutations update the cache in place and return an undo.
//
// Nothing here reaches the network. This file goes with the rest of the prototype once the new list
// is accepted (roadmap F2e).
import { queryOptions, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import { fromDesignStatus } from './logic'
import * as mock from './mock'
import type {
  ActivityEvent,
  AppName,
  DesignStatus,
  DirectoryTenant,
  PlanName,
  TenantAdmin,
  TenantApps,
  TenantProfile,
  Undo,
} from './types'

const key = (...parts: string[]) => ['admin', 'tenants', ...parts] as const

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

export type TenantDirectory = {
  /** The fixture tenants (design seed + anything created or edited this session). */
  tenants: DirectoryTenant[]
  isLoading: boolean
  error: Error | null
}

/**
 * The prototype's tenants, from fixtures only. It used to merge `useTenants()`, written for the
 * previous API's GET /api/v1/tenants (an array); that route now returns a page of tenants (C179),
 * which the merge could not read, so the prototype screens read fixtures until they move to the
 * new API (roadmap F2).
 */
export function useTenantDirectory(): TenantDirectory {
  const profiles = useTenantProfiles()
  const tenants = useMemo(
    () =>
      profiles.map(
        (p): DirectoryTenant => ({
          ...p,
          apiId: null,
          source: 'fixture',
          directoryStatus: fromDesignStatus(p.status),
          createdAt: null,
          hasProfile: true,
        })
      ),
    [profiles]
  )
  return { tenants, isLoading: false, error: null }
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
    /** "Plan & seats" modal. Logs an activity line. */
    setPlan: (slug: string, plan: PlanName, seatLimit: number, seed?: TenantProfile) =>
      change(slug, (p) => ({ ...p, plan, seatLimit }), seed, `Plan set to ${plan} with ${seatLimit} seats`),
    /** "Parent tenant" modal; null = standalone. Caller must block when the tenant has children. */
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
