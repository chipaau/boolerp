// Shell (workspace chrome) resource shapes: things the header and rails show for every app.

export type Notification = { id: string; text: string; time: string; unread: boolean }

/** Counts shown at the right edge of an app's rail, keyed by the `badge.key` in the app registry. */
export type NavCounts = Record<string, number>

/** A user's saved view of a list screen: a section plus the filter/query it presets. */
export type SavedView = { title: string; section: string; search: Record<string, string>; badgeKey?: string }

/** The signed-in user's membership in the current tenant (role label for the account menu). */
export type Membership = { role: string; avatar?: string }
