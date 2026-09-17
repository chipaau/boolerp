// Raising notifications. Apps call `notify(eventKey, payload)`; the event's Control Centre rule says
// who it reaches (roles resolved live through the org data) and on which channels. Fixture-backed:
// it prepends to the bell's cache and returns an undo; later a POST that the API fans out and emails.
// Reads org data by query key rather than importing org/queries, which itself raises events.
import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { resolveRecipients, ruleForEvent } from '@/features/org/logic'
import type { EventSubject } from '@/features/org/logic'
import type { NotificationRule, Person, Site, Unit } from '@/features/org/types'
import { notificationsQuery } from '@/features/shell/queries'
import type { Notification } from '@/features/shell/types'

export type NotifyPayload = Pick<Notification, 'title' | 'meta' | 'category' | 'to'> & {
  /** What the event is about, so roles like "site manager" resolve. */
  subject?: EventSubject
  /** People to reach directly, on top of the rule's roles (or instead, for events with no rule). */
  recipientIds?: string[]
}

const nowTime = () => new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })

/** Returns `notify(eventKey, payload)`, which raises one notification and returns an undo. */
export function useNotify() {
  const qc = useQueryClient()
  return useCallback(
    (eventKey: string, payload: NotifyPayload): (() => void) => {
      const rules = qc.getQueryData<NotificationRule[]>(['org', 'notification-rules']) ?? []
      const org = { people: qc.getQueryData<Person[]>(['org', 'people']) ?? [], units: qc.getQueryData<Unit[]>(['org', 'units']) ?? [], sites: qc.getQueryData<Site[]>(['org', 'sites']) ?? [] }
      const rule = ruleForEvent(rules, eventKey)
      const recipientIds = [...new Set([...(rule ? resolveRecipients(rule.recipientRoles, payload.subject ?? {}, org) : []), ...(payload.recipientIds ?? [])])]
      if (!recipientIds.length) return () => {}
      const id = `n-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
      const { title, meta, category, to } = payload
      const n: Notification = { id, eventKey, recipientIds, title, meta, category, to, time: nowTime(), group: 'Today', unread: true }
      const k = notificationsQuery().queryKey
      qc.setQueryData<Notification[]>(k, (list) => [n, ...(list ?? [])])
      return () => qc.setQueryData<Notification[]>(k, (list) => (list ?? []).filter((x) => x.id !== id))
    },
    [qc]
  )
}
