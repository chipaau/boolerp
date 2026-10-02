// The Home data seam: components read only through these hooks; the query functions are the one
// place that changes at integration (fixture → generated API client). The schedule, the meetings
// count and the heat map's meetings come from the Calendar feature's data, so Home and Calendar
// never disagree about today.
import { useMemo } from 'react'
import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'
import { meetingsOn, toIso, toMinutes } from '@/features/calendar/logic'
import { meQuery, meetingsQuery, peopleQuery } from '@/features/calendar/queries'
import * as mock from './mock'
import type { MonthActivity, ScheduleItem, Stat } from './types'

const key = (...parts: (string | number)[]) => ['home', ...parts] as const

export const statsQuery = () => queryOptions({ queryKey: key('stats'), queryFn: async () => mock.STATS })
export const inboxQuery = () => queryOptions({ queryKey: key('inbox'), queryFn: async () => mock.INBOX })
/** `month` is 0-based, as in `Date`. */
export const monthActivityQuery = (year: number, month: number) =>
  queryOptions({ queryKey: key('activity', year, month), queryFn: async () => mock.monthActivity(year, month) })

/** "09:30" → "9:30 AM", the Home clock style. */
function clock(t: string) {
  const [h, m] = t.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

function useTodaysMeetings() {
  const meetings = useSuspenseQuery(meetingsQuery()).data
  return useMemo(() => meetingsOn(meetings.filter((m) => !m.cancelled), toIso(new Date())), [meetings])
}

/** Headline counters; the meetings figure is today's from the calendar. */
export function useStats(): Stat[] {
  const stats = useSuspenseQuery(statsQuery()).data
  const today = useTodaysMeetings()
  return useMemo(() => [...stats, { value: today.length, label: 'meetings' }], [stats, today])
}

/** The next two meetings still ahead today, as schedule rows: two faces, the rest on the "+n" count. */
export function useSchedule(): ScheduleItem[] {
  const today = useTodaysMeetings()
  const people = useSuspenseQuery(peopleQuery()).data
  const me = useSuspenseQuery(meQuery()).data
  return useMemo(
    () =>
      today
        .filter((m) => toMinutes(m.end) > me.nowMinutes)
        .slice(0, 2)
        .map((m) => {
        const named = m.attendees.map((a) => people.find((p) => p.key === a.person)).filter((p) => p !== undefined)
        return {
          id: m.id,
          meetingId: m.id,
          title: m.title,
          start: clock(m.start),
          end: clock(m.end),
          location: m.room,
          people: named.slice(0, 2).map((p) => ({ name: p.name, photo: p.photo })),
          others: named.slice(2).map((p) => ({ name: p.name, photo: p.photo })),
        }
      }),
    [today, people, me.nowMinutes]
  )
}

export const useInbox = () => useSuspenseQuery(inboxQuery()).data

/** The heat map's days: tasks and approvals from the fixture, meetings counted from the calendar. */
export function useMonthActivity(year: number, month: number): MonthActivity {
  const base = useSuspenseQuery(monthActivityQuery(year, month)).data
  const meetings = useSuspenseQuery(meetingsQuery()).data
  return useMemo(() => {
    const out: MonthActivity = {}
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}-`
    for (const [d, a] of Object.entries(base)) {
      const iso = `${prefix}${String(d).padStart(2, '0')}`
      out[Number(d)] = { ...a, meetings: meetings.filter((m) => m.date === iso && !m.cancelled).length }
    }
    return out
  }, [base, meetings, year, month])
}
