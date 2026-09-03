// The shell data seam. These are non-suspending: chrome renders immediately and the counts / bell
// fill in when they arrive, which is also how it should behave against the real API.
import { queryOptions, useQuery } from '@tanstack/react-query'
import * as mock from './mock'
import type { NavCounts, Notification } from './types'

const key = (...parts: string[]) => ['shell', ...parts] as const

export const notificationsQuery = () => queryOptions({ queryKey: key('notifications'), queryFn: async () => mock.NOTIFICATIONS })
export const navCountsQuery = (app: string) =>
  queryOptions({ queryKey: key('nav-counts', app), queryFn: async (): Promise<NavCounts> => mock.NAV_COUNTS[app] ?? {} })

const NONE: Notification[] = []
const NO_COUNTS: NavCounts = {}

export const useNotifications = () => useQuery(notificationsQuery()).data ?? NONE
export const useNavCounts = (app: string) => useQuery(navCountsQuery(app)).data ?? NO_COUNTS
