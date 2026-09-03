// The Home data seam: components read only through these hooks; the query functions are the one
// place that changes at integration (fixture → generated API client).
import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'
import * as mock from './mock'

const key = (...parts: (string | number)[]) => ['home', ...parts] as const

export const statsQuery = () => queryOptions({ queryKey: key('stats'), queryFn: async () => mock.STATS })
export const scheduleQuery = () => queryOptions({ queryKey: key('schedule'), queryFn: async () => mock.SCHEDULE })
export const inboxQuery = () => queryOptions({ queryKey: key('inbox'), queryFn: async () => mock.INBOX })
/** `month` is 0-based, as in `Date`. */
export const monthActivityQuery = (year: number, month: number) =>
  queryOptions({ queryKey: key('activity', year, month), queryFn: async () => mock.monthActivity(year, month) })

export const useStats = () => useSuspenseQuery(statsQuery()).data
export const useSchedule = () => useSuspenseQuery(scheduleQuery()).data
export const useInbox = () => useSuspenseQuery(inboxQuery()).data
export const useMonthActivity = (year: number, month: number) => useSuspenseQuery(monthActivityQuery(year, month)).data
