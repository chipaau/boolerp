// What the signed-in person sees in the bell and on the Notifications page. Non-suspending, like
// the rest of the shell chrome: the list fills in once notifications, rules and "me" arrive.
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { inAppFor } from '@/features/org/logic'
import { notificationRulesQuery, orgMeQuery } from '@/features/org/queries'
import { useNotifications } from '@/features/shell/queries'

export { useNotify } from './notify'
export type { NotifyPayload } from './notify'

/** Notifications addressed to me whose rule has in-app on; `emailed` mirrors the rule's email flag. */
export function useMyNotifications() {
  const all = useNotifications()
  const rules = useQuery(notificationRulesQuery()).data
  const me = useQuery(orgMeQuery()).data
  return useMemo(() => (rules ? inAppFor(all, rules, me?.id) : []), [all, rules, me])
}
