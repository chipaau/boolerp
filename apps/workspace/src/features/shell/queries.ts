// The shell data seam. These are non-suspending: chrome renders immediately and the counts / bell
// fill in when they arrive, which is also how it should behave against the real API.
import { notificationsKey } from '@workspace/org/notifications'
import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as mock from './mock'
import type { Feedback, Membership, NavCounts, Notification, SavedView, SupportLink } from './types'

const key = (...parts: string[]) => ['shell', ...parts] as const

export const notificationsQuery = () => queryOptions({ queryKey: notificationsKey, queryFn: async () => mock.NOTIFICATIONS })
export const navCountsQuery = (app: string) =>
  queryOptions({ queryKey: key('nav-counts', app), queryFn: async (): Promise<NavCounts> => mock.NAV_COUNTS[app] ?? {} })

export const savedViewsQuery = (app: string) =>
  queryOptions({ queryKey: key('saved-views', app), queryFn: async (): Promise<SavedView[]> => mock.SAVED_VIEWS[app] ?? [] })
export const membershipQuery = () =>
  queryOptions({ queryKey: key('membership'), queryFn: async (): Promise<Membership> => mock.MEMBERSHIP })
export const supportLinksQuery = () => queryOptions({ queryKey: key('support-links'), queryFn: async (): Promise<SupportLink[]> => mock.SUPPORT_LINKS })

const NONE: Notification[] = []
const NO_COUNTS: NavCounts = {}
const NO_VIEWS: SavedView[] = []
const NO_LINKS: SupportLink[] = []

export const useNotifications = () => useQuery(notificationsQuery()).data ?? NONE
export const useNavCounts = (app: string) => useQuery(navCountsQuery(app)).data ?? NO_COUNTS
export const useSavedViews = (app: string) => useQuery(savedViewsQuery(app)).data ?? NO_VIEWS
export const useMembership = () => useQuery(membershipQuery()).data
export const useSupportLinks = () => useQuery(supportLinksQuery()).data ?? NO_LINKS

/** Sends feedback to Bool. Fixture-backed: waits a beat and succeeds; later a POST. */
export function useSendFeedback() {
  return useMutation({
    mutationFn: async (_f: Feedback) => {
      await new Promise((r) => setTimeout(r, 400))
    },
  })
}

/** Marks every notification read. Fixture-backed: updates the cache in place; later a PATCH then invalidate. */
export function useMarkAllRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      qc.setQueryData<Notification[]>(key('notifications'), (list) => list?.map((n) => ({ ...n, unread: false })) ?? [])
    },
  })
}
