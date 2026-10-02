import { describe, expect, it } from 'vitest'
import { dateOverline, daysUntil, isoDate, monthDay, monthYear, ordinal, parseIsoDate, weekdayLong, weekdayShort } from './dates'

const thu = new Date(2026, 8, 3) // Thursday 3 September 2026

describe('dates', () => {
  it('formats names', () => {
    expect(weekdayLong(thu)).toBe('Thursday')
    expect(weekdayShort(thu)).toBe('Thu')
    expect(monthDay(thu)).toBe('September 3')
    expect(monthYear(thu)).toBe('September 2026')
    expect(dateOverline(thu)).toBe('Thursday · September 3')
  })

  it('round-trips local ISO days with zero padding', () => {
    expect(isoDate(new Date(2026, 0, 5))).toBe('2026-01-05')
    expect(isoDate(new Date(2026, 11, 25))).toBe('2026-12-25')
    const d = parseIsoDate('2026-02-09')
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 1, 9, 0])
  })

  it('counts whole days, ignoring the time of today', () => {
    const late = new Date(2026, 8, 3, 23, 59)
    expect(daysUntil('2026-09-03', late)).toBe(0)
    expect(daysUntil('2026-09-10', late)).toBe(7)
    expect(daysUntil('2026-09-01', late)).toBe(-2)
  })

  it.each([
    [1, 'st'], [2, 'nd'], [3, 'rd'], [4, 'th'], [11, 'th'], [12, 'th'], [13, 'th'], [21, 'st'], [22, 'nd'], [23, 'rd'], [111, 'th'], [101, 'st'],
  ])('ordinal(%i) = %s', (n, s) => expect(ordinal(n)).toBe(s))
})
