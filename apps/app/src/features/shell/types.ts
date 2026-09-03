// Shell (workspace chrome) resource shapes: things the header and rails show for every app.

export type Notification = { id: string; text: string; time: string; unread: boolean }

/** Counts shown at the right edge of an app's rail, keyed by the `badge.key` in the app registry. */
export type NavCounts = Record<string, number>
