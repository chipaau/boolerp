// What the signed-in person sees in the bell and on the Notifications page, and their own channel
// preferences. Non-suspending, like the rest of the shell chrome: lists fill in once notifications,
// rules, preferences and "me" arrive. Preferences are personal, so changes are not audited.
import { queryOptions, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import { notificationRulesQuery, orgMeQuery } from '@/features/org/queries'
import { useNotifications } from '@/features/shell/queries'
import type { NotificationCategory } from '@/features/shell/types'
import { deliveredInApp } from './logic'
import * as mock from './mock'
import type { NotificationChannel, NotificationPreference } from './types'

export { useNotify } from './notify'
export type { NotifyPayload } from './notify'

export const notificationPreferencesQuery = () =>
  queryOptions({ queryKey: ['notifications', 'preferences'] as const, queryFn: async (): Promise<NotificationPreference[]> => mock.NOTIFICATION_PREFERENCES })

const NONE: NotificationPreference[] = []

/** Notifications addressed to me that reach me in-app; `emailed` says whether they were also emailed to me. */
export function useMyNotifications() {
  const all = useNotifications()
  const rules = useQuery(notificationRulesQuery()).data
  const prefs = useQuery(notificationPreferencesQuery()).data
  const me = useQuery(orgMeQuery()).data
  return useMemo(() => (rules && prefs ? deliveredInApp(all, rules, prefs, me?.id) : []), [all, rules, prefs, me])
}

/** My personal preference rows (a category with no row follows the organisation). */
export function useNotificationPreferences() {
  const prefs = useQuery(notificationPreferencesQuery()).data ?? NONE
  const me = useQuery(orgMeQuery()).data
  return useMemo(() => prefs.filter((p) => p.personId === me?.id), [prefs, me])
}

const today = () => new Date().toISOString().slice(0, 10)

/** Set or reset my preference for a category. Each returns an undo. Fixture-backed: later a PUT/DELETE then invalidate. */
export function useNotificationPreferenceActions() {
  const qc = useQueryClient()
  const k = notificationPreferencesQuery().queryKey
  const replace = useCallback(
    (personId: string, category: NotificationCategory, next: NotificationPreference | undefined) => {
      let before: NotificationPreference | undefined
      const swap = (row: NotificationPreference | undefined) =>
        qc.setQueryData<NotificationPreference[]>(k, (list = []) => {
          before ??= list.find((p) => p.personId === personId && p.category === category)
          const rest = list.filter((p) => !(p.personId === personId && p.category === category))
          return row ? [...rest, row] : rest
        })
      swap(next)
      return () => {
        const was = before
        swap(was)
      }
    },
    [qc, k]
  )
  const me = () => qc.getQueryData(orgMeQuery().queryKey)?.id
  return {
    /** Turns one channel on or off for a category, starting from the current row or the org default (both on). */
    set: (category: NotificationCategory, channel: NotificationChannel, on: boolean) => {
      const personId = me()
      if (!personId) return () => {}
      const current = (qc.getQueryData<NotificationPreference[]>(k) ?? []).find((p) => p.personId === personId && p.category === category)
      const base = current ?? { personId, category, inApp: true, email: true, updatedOn: today() }
      return replace(personId, category, { ...base, [channel]: on, updatedOn: today() })
    },
    /** Drops my row so the category follows the organisation again. */
    reset: (category: NotificationCategory) => {
      const personId = me()
      return personId ? replace(personId, category, undefined) : () => {}
    },
  }
}
