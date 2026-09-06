// The shell data seam. These are non-suspending: chrome renders immediately and the counts / bell
// fill in when they arrive, which is also how it should behave against the real API.
import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as mock from './mock'
import type { AvatarChoice, Feedback, Membership, NavCounts, Notification, SavedView, SupportLink } from './types'

const key = (...parts: string[]) => ['shell', ...parts] as const

export const notificationsQuery = () => queryOptions({ queryKey: key('notifications'), queryFn: async () => mock.NOTIFICATIONS })
export const navCountsQuery = (app: string) =>
  queryOptions({ queryKey: key('nav-counts', app), queryFn: async (): Promise<NavCounts> => mock.NAV_COUNTS[app] ?? {} })

export const savedViewsQuery = (app: string) =>
  queryOptions({ queryKey: key('saved-views', app), queryFn: async (): Promise<SavedView[]> => mock.SAVED_VIEWS[app] ?? [] })
export const membershipQuery = () => queryOptions({ queryKey: key('membership'), queryFn: async (): Promise<Membership> => mock.MEMBERSHIP })
export const avatarChoicesQuery = () => queryOptions({ queryKey: key('avatar-choices'), queryFn: async (): Promise<AvatarChoice[]> => mock.AVATAR_CHOICES })
export const supportLinksQuery = () => queryOptions({ queryKey: key('support-links'), queryFn: async (): Promise<SupportLink[]> => mock.SUPPORT_LINKS })

const NONE: Notification[] = []
const NO_COUNTS: NavCounts = {}
const NO_VIEWS: SavedView[] = []
const NO_CHOICES: AvatarChoice[] = []
const NO_LINKS: SupportLink[] = []

export const useNotifications = () => useQuery(notificationsQuery()).data ?? NONE
export const useNavCounts = (app: string) => useQuery(navCountsQuery(app)).data ?? NO_COUNTS
export const useSavedViews = (app: string) => useQuery(savedViewsQuery(app)).data ?? NO_VIEWS
export const useMembership = () => useQuery(membershipQuery()).data
export const useAvatarChoices = () => useQuery(avatarChoicesQuery()).data ?? NO_CHOICES
export const useSupportLinks = () => useQuery(supportLinksQuery()).data ?? NO_LINKS

/** Sets (or clears) the signed-in person's photo. Fixture-backed: cache only; later an upload then PATCH. */
export function useSetAvatar() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (avatar: string | undefined) => {
      qc.setQueryData<Membership>(key('membership'), (m) => ({ ...(m ?? mock.MEMBERSHIP), avatar }))
    },
  })
}

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
