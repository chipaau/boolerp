// The geographies data seam (countries + atolls/states/cities). Fixture-backed; mutations update the
// cache in place and return an undo. Guarded status changes return `{ ok: false, reason }` instead.
import { queryOptions, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import * as mock from './mock'
import type { AddCountryInput, AddGeographyInput, Country, CountryStatus, Geography, GeographyStatus, GeographySummary, GuardedResult, Undo } from './types'

const key = (...parts: string[]) => ['admin', 'geographies', ...parts] as const

const fixture = <T>(k: readonly string[], data: T) =>
  queryOptions({ queryKey: k, queryFn: async () => data, initialData: data, staleTime: Infinity })

export const countriesQuery = () => fixture(key('countries'), mock.COUNTRIES)
export const geographiesQuery = () => fixture(key('places'), mock.GEOGRAPHIES)

export const useCountries = () => useQuery(countriesQuery()).data ?? mock.COUNTRIES
export const useGeographies = () => useQuery(geographiesQuery()).data ?? mock.GEOGRAPHIES
export const useGeographyTypes = () => mock.GEOGRAPHY_TYPES

/** Active countries only (wizard/address and drawer pickers). */
export const useActiveCountries = () => {
  const list = useCountries()
  return useMemo(() => list.filter((c) => c.status === 'Active'), [list])
}

/** Top-level geographies (atolls/states) of a country — the wizard's "Atoll / State" options. */
export const useTopLevelGeographies = (country: string) => {
  const list = useGeographies()
  return useMemo(() => list.filter((g) => g.country === country && g.depth === 0), [list, country])
}

/** Geographies directly under a parent — the wizard's "Island / City" options. */
export const useChildGeographies = (parent: string) => {
  const list = useGeographies()
  return useMemo(() => list.filter((g) => g.parent === parent), [list, parent])
}

export function useGeographySummary(): GeographySummary {
  const countries = useCountries()
  const places = useGeographies()
  return useMemo(
    () => ({
      total: places.length,
      activeCountries: countries.filter((c) => c.status === 'Active').length,
      unused: places.filter((g) => !g.use && g.status !== 'Inactive').length,
    }),
    [countries, places]
  )
}

export function useGeographyActions() {
  const qc = useQueryClient()
  const swap = useCallback(<T>(k: readonly string[], fn: (v: T) => T): Undo => {
    const before = qc.getQueryData<T>(k)
    qc.setQueryData<T>(k, (v) => fn(v as T))
    return () => qc.setQueryData<T>(k, before)
  }, [qc])

  return {
    /** Refused when deactivating a geography used by tenants. */
    setGeographyStatus: (name: string, status: GeographyStatus): GuardedResult => {
      const g = (qc.getQueryData<Geography[]>(key('places')) ?? []).find((x) => x.name === name)
      if (!g) return { ok: false, reason: `${name} was not found.` }
      if (g.status === 'Active' && status !== 'Active' && g.use) return { ok: false, reason: `${g.name} is used by ${g.use} tenant(s). Move them before you deactivate it.` }
      return { ok: true, undo: swap<Geography[]>(key('places'), (l) => l.map((x) => (x.name === name ? { ...x, status } : x))) }
    },
    /** Refused when deactivating a country that still holds geographies. */
    setCountryStatus: (code: string, status: CountryStatus): GuardedResult => {
      const c = (qc.getQueryData<Country[]>(key('countries')) ?? []).find((x) => x.code === code)
      if (!c) return { ok: false, reason: `${code} was not found.` }
      if (c.status === 'Active' && status === 'Inactive' && c.geographyCount) return { ok: false, reason: `${c.name} holds ${c.geographyCount} geographies. Deactivate those first.` }
      return { ok: true, undo: swap<Country[]>(key('countries'), (l) => l.map((x) => (x.code === code ? { ...x, status } : x))) }
    },
    /** Adds as Active, depth 1 unless parent is the country. Refused on a duplicate name (case-insensitive). */
    addGeography: (input: AddGeographyInput): GuardedResult => {
      const places = qc.getQueryData<Geography[]>(key('places')) ?? []
      if (places.some((g) => g.name.toLowerCase() === input.name.trim().toLowerCase()))
        return { ok: false, reason: `A geography called ${input.name} already exists.` }
      const g: Geography = {
        name: input.name.trim(), type: input.type, country: input.country, parent: input.parent,
        postal: input.postal?.trim() || '—', status: 'Active', use: 0, depth: input.parent === input.country ? 0 : 1,
      }
      const undoPlace = swap<Geography[]>(key('places'), (l) => {
        let at = -1
        l.forEach((x, i) => { if (x.country === g.country && (x.name === g.parent || x.parent === g.parent)) at = i })
        return at < 0 ? [...l, g] : [...l.slice(0, at + 1), g, ...l.slice(at + 1)]
      })
      const undoCount = swap<Country[]>(key('countries'), (l) => l.map((c) => (c.name === g.country ? { ...c, geographyCount: c.geographyCount + 1 } : c)))
      return { ok: true, undo: () => (undoCount(), undoPlace()) }
    },
    /** Adds as Active. Refused on a duplicate code. */
    addCountry: (input: AddCountryInput): GuardedResult => {
      const code = input.code.trim().toUpperCase()
      if ((qc.getQueryData<Country[]>(key('countries')) ?? []).some((c) => c.code === code)) return { ok: false, reason: `${code} is already added.` }
      const c: Country = { code, name: input.name.trim(), dial: input.dial.trim(), added: mock.TODAY, status: 'Active', geographyCount: 0 }
      return { ok: true, undo: swap<Country[]>(key('countries'), (l) => [...l, c]) }
    },
  }
}
