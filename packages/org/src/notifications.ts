// The workspace's notification feed (the header bell), as apps raise into it with notify().
// The shell owns the feed's query (features/shell/queries); its key lives here so notify can
// write to it without importing the shell.

/** The feed's query key: ['shell', 'notifications']. */
export const notificationsKey = ['shell', 'notifications'] as const

export type NotificationCategory = 'Meetings' | 'Stock' | 'Approvals' | 'Orders' | 'Setup' | 'Billing'
export type NotificationGroup = 'Today' | 'Yesterday' | 'Earlier'
export type Notification = {
  id: string
  /**
   * The event that raised it (`controlcentre.site_paused`). When a Control Centre notification rule
   * has this key, the rule decides whether it shows in-app and whether it was also emailed; events
   * with no rule (a meeting invite) are addressed to their people directly.
   */
  eventKey: string
  /** Org person ids it was addressed to, resolved when it was raised. */
  recipientIds: string[]
  title: string
  /** One line of context under the title (where, who, how much). */
  meta: string
  category: NotificationCategory
  /** Display time within its group ("02:37 PM" today, "21 Jul" earlier). */
  time: string
  group: NotificationGroup
  unread: boolean
  /** Where the row leads: an app, optionally a section and a record id. */
  to: { app: string; section?: string; id?: string }
}
