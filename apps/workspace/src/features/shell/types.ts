// Shell (workspace chrome) resource shapes: things the header and rails show for every app.

export type { Notification, NotificationCategory, NotificationGroup } from '@workspace/org/notifications'

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
