import { describe, expect, it } from 'vitest'
import { holidayForEveryone, holidayOn, nextCountDue, upcomingHolidays } from './logic'
import type { Cadence, Holiday, Site, SiteType } from './types'

const hol = (id: string, date: string, over: Partial<Holiday> = {}): Holiday => ({
  id, name: id, nameDv: '', date, halfDay: false, origin: 'custom', on: true, appliesTo: { units: [], sites: [] }, ...over,
})

describe('holidayForEveryone', () => {
  it('is true only with no unit or site narrowing', () => {
    expect(holidayForEveryone(hol('a', '2026-01-01'))).toBe(true)
    expect(holidayForEveryone(hol('a', '2026-01-01', { appliesTo: { units: ['u1'], sites: [] } }))).toBe(false)
    expect(holidayForEveryone(hol('a', '2026-01-01', { appliesTo: { units: [], sites: ['s1'] } }))).toBe(false)
  })
})

describe('holidayOn', () => {
  const unitDay = hol('unit', '2026-07-26', { appliesTo: { units: ['u-parent'], sites: [] } })
  const siteDay = hol('site', '2026-07-26', { appliesTo: { units: [], sites: ['s-1'] } })
  const everyone = hol('all', '2026-07-26')
  const off = hol('off', '2026-07-27', { on: false })

  it('without a scope only everyone-wide days count', () => {
    expect(holidayOn([unitDay, siteDay], '2026-07-26')).toBeUndefined()
    expect(holidayOn([unitDay, everyone], '2026-07-26')).toBe(everyone)
  })
  it('ignores switched-off days and other dates', () => {
    expect(holidayOn([off], '2026-07-27')).toBeUndefined()
    expect(holidayOn([everyone], '2026-07-25')).toBeUndefined()
  })
  it('matches a unit scope (ancestors included by the caller)', () => {
    expect(holidayOn([unitDay], '2026-07-26', { units: ['u-child', 'u-parent'] })).toBe(unitDay)
    expect(holidayOn([unitDay], '2026-07-26', { units: ['u-other'] })).toBeUndefined()
    expect(holidayOn([unitDay], '2026-07-26', { site: 's-1' })).toBeUndefined()
  })
  it('matches a site scope, and a null site matches nothing', () => {
    expect(holidayOn([siteDay], '2026-07-26', { site: 's-1' })).toBe(siteDay)
    expect(holidayOn([siteDay], '2026-07-26', { site: 's-2' })).toBeUndefined()
    expect(holidayOn([siteDay], '2026-07-26', { units: [], site: null })).toBeUndefined()
  })
  it('prefers the everyone-wide day over a narrowed one', () => {
    expect(holidayOn([siteDay, everyone], '2026-07-26', { site: 's-1' })).toBe(everyone)
  })
})

describe('upcomingHolidays', () => {
  it('keeps active days from today on, sorted, without mutating the input', () => {
    const list = [hol('c', '2026-12-01'), hol('past', '2026-09-16'), hol('today', '2026-09-17'), hol('off', '2026-10-01', { on: false }), hol('b', '2026-11-01')]
    const copy = [...list]
    expect(upcomingHolidays(list, new Date(2026, 8, 17, 18)).map((h) => h.id)).toEqual(['today', 'b', 'c'])
    expect(list).toEqual(copy)
  })
})

describe('nextCountDue', () => {
  const type = (cadence: Cadence) => ({ cadence }) as SiteType
  const site = (counted: string, cadence: Cadence | null = null) => ({ counted, cadence }) as Site
  const today = new Date(2026, 8, 17)

  it('is undefined when not counted, never counted or unparseable', () => {
    expect(nextCountDue(site('2 Sep 2026'), type('None'), today)).toBeUndefined()
    expect(nextCountDue(site('—'), type('Weekly'), today)).toBeUndefined()
    expect(nextCountDue(site('not a date'), type('Weekly'), today)).toBeUndefined()
  })
  it('steps weekly past today', () => {
    expect(nextCountDue(site('2 Sep 2026'), type('Weekly'), today)).toBe('2026-09-23')
    expect(nextCountDue(site('10 Sep 2026'), type('Weekly'), today)).toBe('2026-09-17')
  })
  it('steps monthly and quarterly', () => {
    expect(nextCountDue(site('18 Aug 2026'), type('Monthly'), today)).toBe('2026-09-18')
    expect(nextCountDue(site('2 Jan 2026'), type('Quarterly'), today)).toBe('2026-10-02')
  })
  it('a site cadence overrides its type', () => {
    expect(nextCountDue(site('2 Sep 2026', 'Monthly'), type('Weekly'), today)).toBe('2026-10-02')
    expect(nextCountDue(site('2 Sep 2026', 'None'), type('Weekly'), today)).toBeUndefined()
  })
})
