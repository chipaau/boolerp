// Shell (workspace chrome) resource shapes: things the header and rails show for every app.

export type NotificationCategory = 'Meetings' | 'Stock' | 'Approvals' | 'Orders' | 'Setup'
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

/** Counts shown at the right edge of an app's rail, keyed by the `badge.key` in the app registry. */
export type NavCounts = Record<string, number>

/** A user's saved view of a list screen: a section plus the filter/query it presets. */
export type SavedView = { title: string; section: string; search: Record<string, string>; badgeKey?: string }

/** The signed-in user's membership in the current tenant (role label for the account menu). */
export type Membership = { role: string; avatar?: string }

/** A photo the workspace offers for people without their own; `src` is what the avatar shows. */
export type AvatarChoice = { id: string; src: string; label: string }

/** Where "Support" leads: the help centre, the support inbox, the changelog. */
export type SupportLink = { label: string; href: string; hint: string }

export type FeedbackKind = 'idea' | 'problem' | 'question'
export type Feedback = { kind: FeedbackKind; message: string; page?: string }
