// Pure calendar logic: dates and times as strings, meeting queries, lane packing for the week
// grid, room availability and time suggestions. No data lives here.
import type { BadgeTone } from '@workspace/ui/components/badge'
import type { AgendaItem, CalendarKey, Meeting, Recurrence, Rsvp, CalendarView } from './types'

/** The visible day runs 8am to 7pm; the week grid draws each hour at this height. */
export const DAY_START = 8
export const DAY_END = 19
export const HOUR_PX = 54

// ---- time
export const toMinutes = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}
export const fromMinutes = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
/** "09:30" → "9:30am", "13:00" → "1pm". */
export function fmtTime(t: string) {
  const m = toMinutes(t), h = Math.floor(m / 60), mm = m % 60
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}${mm ? ':' + String(mm).padStart(2, '0') : ''}${h >= 12 ? 'pm' : 'am'}`
}
export const fmtRange = (s: string, e: string) => `${fmtTime(s)} – ${fmtTime(e)}`
export function fmtDuration(mins: number) {
  const h = Math.floor(mins / 60), m = mins % 60
  return h ? `${h}h${m ? ' ' + m + 'm' : ''}` : `${m} min`
}
export const snap15 = (v: number) => Math.max(DAY_START * 60, Math.min(DAY_END * 60, Math.round(v / 15) * 15))

// ---- dates (local ISO days)
export const toIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export function parseIso(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}
export function addDays(iso: string, n: number) {
  const d = parseIso(iso)
  d.setDate(d.getDate() + n)
  return toIso(d)
}
export function addMonths(iso: string, n: number) {
  const d = parseIso(iso)
  return toIso(new Date(d.getFullYear(), d.getMonth() + n, 1))
}
/** Sunday-first week, as in the design. */
export function startOfWeek(iso: string) {
  const d = parseIso(iso)
  return addDays(iso, -d.getDay())
}
export const firstOfMonth = (iso: string) => iso.slice(0, 8) + '01'
export function daysInMonth(iso: string) {
  const d = parseIso(iso)
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
}
/** 42 days covering the month's grid, Sunday-first. */
export function monthGrid(iso: string) {
  const d = parseIso(firstOfMonth(iso))
  const lead = d.getDay()
  return Array.from({ length: 42 }, (_, i) => toIso(new Date(d.getFullYear(), d.getMonth(), 1 - lead + i)))
}
export const sameMonth = (a: string, b: string) => a.slice(0, 7) === b.slice(0, 7)
export const isWeekend = (iso: string) => [0, 6].includes(parseIso(iso).getDay())
export const dayOfMonth = (iso: string) => parseIso(iso).getDate()
export const weekdayShort = (iso: string) => parseIso(iso).toLocaleDateString('en-GB', { weekday: 'short' })
export const weekdayLong = (iso: string) => parseIso(iso).toLocaleDateString('en-GB', { weekday: 'long' })
export const monthShort = (iso: string) => parseIso(iso).toLocaleDateString('en-GB', { month: 'short' })
export const monthLong = (iso: string) => parseIso(iso).toLocaleDateString('en-GB', { month: 'long' })
export const monthYear = (iso: string) => parseIso(iso).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
/** "Thu 3 Sep" */
export const shortDate = (iso: string) => `${weekdayShort(iso)} ${dayOfMonth(iso)} ${monthShort(iso)}`
/** "Thursday 3 September" */
export const longDate = (iso: string) => `${weekdayLong(iso)} ${dayOfMonth(iso)} ${monthLong(iso)}`
/** "30 Aug – 5 Sep 2026" */
export function rangeTitle(from: string, to: string) {
  return `${dayOfMonth(from)} ${monthShort(from)} – ${dayOfMonth(to)} ${monthShort(to)} ${parseIso(to).getFullYear()}`
}

// ---- agenda
/** Agenda items as the editor's document: a numbered list, each line ending in its minutes. */
export function agendaToHtml(items: AgendaItem[]) {
  if (!items.length) return ''
  return `<ol>${items.map((a) => `<li>${escapeHtml(a.text)}${a.minutes ? ` · ${escapeHtml(a.minutes)}` : ''}</li>`).join('')}</ol>`
}
/** List items (or paragraphs) back into agenda items; a trailing "· 10 min" or "(10 min)" becomes the minutes. */
export function agendaFromHtml(html: string): AgendaItem[] {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const nodes = doc.querySelectorAll('li').length ? doc.querySelectorAll('li') : doc.querySelectorAll('p')
  return [...nodes]
    .map((n) => n.textContent.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .map((line) => {
      const m = /^(.*?)[\s·\-–(]*(\d+\s*min)\)?\s*$/i.exec(line)
      return m && m[1].trim() ? { text: m[1].trim(), minutes: m[2].replace(/\s+/, ' ') } : { text: line, minutes: '' }
    })
}
function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// ---- meetings
export type Filters = { hidden: CalendarKey[]; mine: boolean; declined: boolean; query: string }
export const NO_FILTERS: Filters = { hidden: [], mine: false, declined: false, query: '' }

export function myRsvp(m: Meeting, me: string): Rsvp | 'none' {
  return m.attendees.find((a) => a.person === me)?.rsvp ?? 'none'
}

export const RSVP_META: Record<Rsvp, { label: string; tone: BadgeTone }> = {
  yes: { label: 'Going', tone: 'success' },
  no: { label: 'Declined', tone: 'risk' },
  maybe: { label: 'Maybe', tone: 'warning' },
  pending: { label: 'No reply', tone: 'slate' },
}

/** Tentative = dashed edge in the grids: the person has not committed. */
export const isTentative = (r: Rsvp | 'none') => r === 'maybe' || r === 'pending' || r === 'none'

export function visibleMeetings(meetings: Meeting[], f: Filters, me: string, names: (key: string) => string) {
  const q = f.query.trim().toLowerCase()
  return meetings.filter((m) => {
    if (f.hidden.includes(m.calendar)) return false
    if (f.declined && myRsvp(m, me) === 'no') return false
    if (f.mine && m.organiser !== me) return false
    if (!q) return true
    const hay = `${m.title} ${m.room} ${m.attendees.map((a) => names(a.person)).join(' ')}`.toLowerCase()
    return hay.includes(q)
  })
}

export const byStart = (a: Meeting, b: Meeting) => toMinutes(a.start) - toMinutes(b.start)
export const meetingsOn = (list: Meeting[], iso: string) => list.filter((m) => m.date === iso).sort(byStart)
export const minutesOf = (list: Meeting[]) => list.reduce((n, m) => n + (toMinutes(m.end) - toMinutes(m.start)), 0)
export const hoursLabel = (mins: number) => `${Math.round(mins / 6) / 10}h`

/** Places overlapping meetings side by side. */
export type Placed = { m: Meeting; s: number; e: number; lane: number; lanes: number }
export function packLanes(list: Meeting[]): Placed[] {
  const evs = list.map((m) => ({ m, s: toMinutes(m.start), e: toMinutes(m.end), lane: 0, lanes: 1 }))
  const ends: number[] = []
  for (const ev of evs) {
    const free = ends.findIndex((end) => end <= ev.s)
    if (free === -1) {
      ev.lane = ends.length
      ends.push(ev.e)
    } else {
      ev.lane = free
      ends[free] = ev.e
    }
  }
  const lanes = Math.max(1, ends.length)
  return evs.map((ev) => ({ ...ev, lanes }))
}

// ---- rooms and availability
export function roomBusy(meetings: Meeting[], room: string, iso: string) {
  return meetings.filter((m) => m.room === room && m.date === iso && !m.cancelled).sort(byStart)
}
/** Free stretches (≥ 30 min) across the visible day, in minutes. */
export function roomGaps(busy: Meeting[]): [number, number][] {
  const marks: [number, number][] = busy.map((m) => [toMinutes(m.start), toMinutes(m.end)])
  marks.push([DAY_END * 60, DAY_END * 60])
  const gaps: [number, number][] = []
  let cur = DAY_START * 60
  for (const [s, e] of marks) {
    if (s - cur >= 30) gaps.push([cur, s])
    cur = Math.max(cur, e)
  }
  return gaps
}
export const overlaps = (m: Meeting, s: number, e: number) => toMinutes(m.start) < e && toMinutes(m.end) > s
export const isRoomFree = (meetings: Meeting[], room: string, iso: string, s: number, e: number) =>
  !roomBusy(meetings, room, iso).some((m) => overlaps(m, s, e))
export const isPersonFree = (meetings: Meeting[], person: string, iso: string, s: number, e: number) =>
  !meetings.some((m) => m.date === iso && !m.cancelled && m.attendees.some((a) => a.person === person) && overlaps(m, s, e))

/** The five best starts for `duration` minutes on `iso`, ranked by how many invitees are free. */
export function suggestSlots(meetings: Meeting[], people: string[], iso: string, duration: number) {
  const out: { s: number; e: number; free: number }[] = []
  for (let s = DAY_START * 60; s + duration <= (DAY_END - 1) * 60; s += 30) {
    out.push({ s, e: s + duration, free: people.filter((p) => isPersonFree(meetings, p, iso, s, s + duration)).length })
  }
  return out.sort((a, b) => b.free - a.free || a.s - b.s).slice(0, 5).sort((a, b) => a.s - b.s)
}

export const RECURRENCES: { value: Recurrence; label: string }[] = [
  { value: '', label: 'Does not repeat' },
  { value: 'Daily', label: 'Every day' },
  { value: 'Weekdays', label: 'Every weekday' },
  { value: 'Weekly', label: 'Every week' },
  { value: 'Fortnightly', label: 'Every two weeks' },
  { value: 'Monthly', label: 'Every month' },
  { value: 'Quarterly', label: 'Every quarter' },
]
export const recurrenceLabel = (r: Recurrence) => (r ? RECURRENCES.find((x) => x.value === r)?.label ?? r : '')

export const VIEWS: { key: CalendarView; label: string; hint: string }[] = [
  { key: 'day', label: 'Day', hint: 'D' },
  { key: 'month', label: 'Month', hint: 'M' },
  { key: 'week', label: 'Week', hint: 'W' },
  { key: 'agenda', label: 'Agenda', hint: 'A' },
  { key: 'rooms', label: 'Rooms', hint: 'R' },
]
