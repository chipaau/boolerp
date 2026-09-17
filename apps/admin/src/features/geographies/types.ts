// Geography shapes from the Bool Admin design. Pending SRS/data-model review.
export type { Undo } from '@/features/tenants/types'

export type CountryStatus = 'Active' | 'Inactive'

export type Country = {
  /** ISO 3166-1 alpha-2; the key. */
  code: string
  name: string
  dial: string
  added: string
  status: CountryStatus
  /** Geographies held (design seed value; incremented by `addGeography`). */
  geographyCount: number
}

export type GeographyType = 'Atoll' | 'State' | 'City' | 'Island' | 'Ward'
export type GeographyStatus = 'Active' | 'Inactive' | 'Draft'

export type Geography = {
  /** Unique across all countries; the key. */
  name: string
  type: GeographyType
  /** Country name. */
  country: string
  /** A top-level geography's parent is its country name. */
  parent: string
  /** '—' when none. */
  postal: string
  status: GeographyStatus
  /** Tenants using it. */
  use: number
  /** 0 = top level (atoll/state), 1 = under another geography. */
  depth: 0 | 1
}

/** A status change the design refuses (in use) comes back as `ok: false` with the message to toast. */
export type GuardedResult = { ok: true; undo: () => void } | { ok: false; reason: string }

export type AddGeographyInput = { country: string; type: GeographyType; parent: string; name: string; postal?: string }
export type AddCountryInput = { name: string; code: string; dial: string }

export type GeographySummary = { total: number; activeCountries: number; unused: number }
