import { describe, expect, it } from 'vitest'
import { countryOptions, institutionTypeOptions, legalFormOptions } from './options'
import { timezoneOptions, timezones, utcOffset } from './timezones'
import { withPrimary } from './institution-types-field'

describe('countryOptions', () => {
  it('shows the name, searches both codes, and shows the dialling prefix', () => {
    expect(countryOptions([{ code: 'MV', alpha3: 'MDV', name: 'Maldives', phonePrefix: '+960' }])).toEqual([
      { value: 'MV', label: 'Maldives', keywords: 'MV MDV', detail: '+960' },
    ])
  })
})

describe('legalFormOptions', () => {
  it('groups by category in a fixed order, keeping the API’s name order inside each, with the document beside it', () => {
    const form = (name: string, category: 'government' | 'private' | 'non_profit' | 'international', doc: string | null) => ({
      id: `0192f6a0-0000-7000-8000-${String(name.length).padStart(12, '0')}`,
      code: name.toLowerCase().replaceAll(' ', '_'),
      name,
      category,
      identityDocument: doc,
    })
    const options = legalFormOptions([
      form('Cooperative', 'non_profit', 'Cooperative registration number'),
      form('Ministry', 'government', null),
      form('Private company', 'private', 'Company registration number'),
      form('Council', 'government', null),
    ])
    expect(options.map((o) => [o.group, o.label, o.detail])).toEqual([
      ['Government', 'Ministry', undefined],
      ['Government', 'Council', undefined],
      ['Private', 'Private company', 'Company registration number'],
      ['Non-profit', 'Cooperative', 'Cooperative registration number'],
    ])
  })
})

describe('institutionTypeOptions', () => {
  it('groups each type under its sector, whose name is searchable', () => {
    expect(institutionTypeOptions([{ code: 'hospital', name: 'Hospital', sector: { code: 'health', name: 'Health' } }])).toEqual([
      { value: 'hospital', label: 'Hospital', keywords: 'Health', group: 'Health' },
    ])
  })
})

describe('withPrimary', () => {
  it('makes the first chosen type primary until another is marked', () => {
    expect(withPrimary(['clinic'], null)).toEqual({ codes: ['clinic'], primary: 'clinic' })
    expect(withPrimary(['clinic', 'pharmacy'], 'pharmacy')).toEqual({ codes: ['clinic', 'pharmacy'], primary: 'pharmacy' })
  })

  it('moves the primary to the first remaining type when the primary is removed, and clears it when none is left', () => {
    expect(withPrimary(['pharmacy'], 'clinic')).toEqual({ codes: ['pharmacy'], primary: 'pharmacy' })
    expect(withPrimary([], 'clinic')).toEqual({ codes: [], primary: null })
  })
})

describe('time zones', () => {
  it('lists the browser’s IANA zones', () => {
    const zones = timezones()
    expect(zones).toContain('Indian/Maldives')
    expect(zones).toContain('Asia/Dubai')
  })

  it('shows a zone’s offset from UTC', () => {
    const at = new Date('2026-01-15T12:00:00Z')
    expect(utcOffset('Indian/Maldives', at)).toBe('UTC+05:00')
    expect(utcOffset('Etc/UTC', at)).toBe('UTC+00:00')
    expect(utcOffset('America/New_York', at)).toBe('UTC-05:00')
  })

  it('reads a zone with spaces, grouped by region, searchable by its name', () => {
    expect(timezoneOptions(['America/Port_of_Spain', 'UTC'], new Date('2026-01-15T12:00:00Z'))).toEqual([
      { value: 'America/Port_of_Spain', label: 'America / Port of Spain', keywords: 'America/Port_of_Spain', group: 'America', detail: 'UTC-04:00' },
      { value: 'UTC', label: 'UTC', keywords: 'UTC', group: 'Other', detail: 'UTC+00:00' },
    ])
  })
})
