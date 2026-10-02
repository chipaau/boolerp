// Who gets what, on which channel. The organisation's rule sets the channels for an event; a
// person's preference for the event's category can only turn channels off, never on. Mandatory
// rules ignore preferences. Events with no rule (a meeting invite) are personal: in-app only,
// unless the person muted that category in-app.
import type { NotificationRule } from '@workspace/org/types'
import type { NotificationCategory } from '@/features/shell/types'
import type { NotificationPreference } from './types'

/** Every category a person can tune, in the order the preferences page lists them. */
export const NOTIFICATION_CATEGORIES: { category: NotificationCategory; description: string }[] = [
  { category: 'Meetings', description: 'Invites, shift changes and public holidays.' },
  { category: 'Stock', description: 'Low stock, counts, variances and scanners.' },
  { category: 'Approvals', description: 'Requests you raised or need to sign off.' },
  { category: 'Orders', description: 'Purchase orders, deliveries and receipts.' },
  { category: 'Setup', description: 'Sites, people and workspace changes.' },
  { category: 'Billing', description: 'Invoices, payments and your plan.' },
]

const PREFIX_CATEGORY: Record<string, NotificationCategory> = {
  calendar: 'Meetings',
  meetings: 'Meetings',
  inventory: 'Stock',
  scan: 'Stock',
  approvals: 'Approvals',
  orders: 'Orders',
  procurement: 'Orders',
  billing: 'Billing',
  controlcentre: 'Setup',
}

/** The category an event belongs to, from its key's prefix (`inventory.count_due` → Stock); unknown prefixes are Setup. */
export const categoryForEvent = (eventKey: string): NotificationCategory => PREFIX_CATEGORY[eventKey.split('.')[0]] ?? 'Setup'

export type Delivery = { inApp: boolean; email: boolean }

export const preferenceFor = (prefs: NotificationPreference[], personId: string, category: NotificationCategory) =>
  prefs.find((p) => p.personId === personId && p.category === category)

/**
 * The channels an event reaches a person on. With a rule: the rule's channels, narrowed by the
 * person's category preference unless the rule is mandatory. Without one: in-app, unless muted.
 */
export function deliveryFor(rule: NotificationRule | undefined, pref: NotificationPreference | undefined): Delivery {
  if (!rule) return { inApp: pref ? pref.inApp : true, email: false }
  if (rule.mandatory || !pref) return { inApp: rule.inApp, email: rule.email }
  return { inApp: rule.inApp && pref.inApp, email: rule.email && pref.email }
}

/** The notifications a person sees in-app, each marked with whether it was also emailed to them. */
export function deliveredInApp<T extends { eventKey: string; recipientIds: string[]; category: NotificationCategory }>(
  list: T[],
  rules: NotificationRule[],
  prefs: NotificationPreference[],
  personId: string | undefined
): (T & { emailed: boolean })[] {
  if (!personId) return []
  return list.flatMap((n) => {
    if (!n.recipientIds.includes(personId)) return []
    const rule = rules.find((r) => r.eventKey === n.eventKey)
    const d = deliveryFor(rule, preferenceFor(prefs, personId, rule ? categoryForEvent(rule.eventKey) : n.category))
    return d.inApp ? [{ ...n, emailed: d.email }] : []
  })
}
