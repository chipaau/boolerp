// Dates and times as the clinics keep them: Maldives time (UTC+5), dates as YYYY-MM-DD and times as
// HH:MM, independent of the browser's own time zone.

const MVT_MS = 5 * 3600e3

export const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
export const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

export const nowMs = () => Date.now()
const mvtNow = () => new Date(nowMs() + MVT_MS)

/** Today in Maldives time, YYYY-MM-DD. */
export const today = () => mvtNow().toISOString().slice(0, 10)

/** Minutes since midnight, Maldives time. */
export const nowMin = () => {
  const d = mvtNow()
  return d.getUTCHours() * 60 + d.getUTCMinutes()
}

const utc = (date: string) => new Date(date + 'T00:00:00Z')

export const addDays = (date: string, n: number) => {
  const d = utc(date)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** Day of the week, 0 = Sunday. */
export const dow = (date: string) => utc(date).getUTCDay()

/** "Tue 14 Oct" */
export const fmtDate = (date: string) => {
  const d = utc(date)
  return `${DOW[d.getUTCDay()]} ${d.getUTCDate()} ${MON[d.getUTCMonth()]}`
}

/** "Today", "Tomorrow", or "Tue 14 Oct". */
export const fmtDay = (date: string) => {
  const t = today()
  if (date === t) return 'Today'
  if (date === addDays(t, 1)) return 'Tomorrow'
  return fmtDate(date)
}

export const toMin = (time: string) => {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

export const toTime = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

/** When a session or slot starts, as an instant. */
export const startMs = (date: string, time: string) => Date.parse(`${date}T${time}:00Z`) - MVT_MS

/** Age in whole years today, or null without a date of birth. */
export const age = (dob: string | null) => {
  if (!dob) return null
  const t = today()
  let a = Number(t.slice(0, 4)) - Number(dob.slice(0, 4))
  if (t.slice(5) < dob.slice(5)) a--
  return a
}

/** "morning" before 12:00, "afternoon" before 17:00, then "evening". */
export const periodOf = (time: string) => {
  const m = toMin(time)
  return m < 12 * 60 ? 'morning' : m < 17 * 60 ? 'afternoon' : 'evening'
}

/** Minutes until an instant, never below zero. */
export const minutesUntil = (ms: number) => Math.max(0, Math.floor((ms - nowMs()) / 60000))
