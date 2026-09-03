// Date presentation shared by the shell and screens, so every date reads the same way.
// Weekday and month names follow the design (en-GB weekday, en-US "September 3" order).

export const weekdayLong = (d: Date) => d.toLocaleDateString('en-GB', { weekday: 'long' })
export const monthDay = (d: Date) => d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
export const monthYear = (d: Date) => d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

/** The overline above page titles: "Thursday · September 3". */
export const dateOverline = (d: Date) => `${weekdayLong(d)} · ${monthDay(d)}`

/** Local calendar date as YYYY-MM-DD (for search params and day keys). */
export function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 1 → "st", 2 → "nd", 3 → "rd", 11–13 → "th". */
export function ordinal(n: number) {
  const v = n % 100
  if (v >= 11 && v <= 13) return 'th'
  switch (n % 10) {
    case 1:
      return 'st'
    case 2:
      return 'nd'
    case 3:
      return 'rd'
    default:
      return 'th'
  }
}
