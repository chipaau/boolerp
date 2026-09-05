// Shell (workspace chrome) resource shapes: things the header and rails show for every app.

export type NotificationCategory = 'Meetings' | 'Stock' | 'Approvals' | 'Orders'
export type NotificationGroup = 'Today' | 'Yesterday' | 'Earlier'
export type Notification = {
  id: string
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

/** Counts shown at the right edge of an app's rail, keyed by the `badge.key` in the app registry. */
export type NavCounts = Record<string, number>

/** A user's saved view of a list screen: a section plus the filter/query it presets. */
export type SavedView = { title: string; section: string; search: Record<string, string>; badgeKey?: string }

/** The signed-in user's membership in the current tenant (role label for the account menu). */
export type Membership = { role: string; avatar?: string }
