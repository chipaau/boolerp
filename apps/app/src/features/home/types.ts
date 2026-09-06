import type { BadgeTone } from '@workspace/ui/components/badge'

// Home resource shapes. Mirrors what the API will return; once `packages/api-client` is
// generated these become re-exports of the generated types.

export type Stat = { value: number; label: string }

export type Person = { name: string; photo?: string }

/** `people` are shown as avatars; `others` are the rest, listed with their photos on the "+n" count. */
export type ScheduleItem = {
  id: string
  /** The calendar meeting this row opens. */
  meetingId: string
  title: string
  start: string
  end: string
  /** Room, site or link label. */
  location: string
  people: Person[]
  others?: Person[]
}

export type InboxTone = BadgeTone
export type InboxItem = {
  id: string
  /** App the item belongs to (drives the icon). */
  app: string
  title: string
  tag: { label: string; tone: InboxTone }
  meta: { label: string; overdue?: boolean }[]
  action: 'Review' | 'Approve'
}

/** What a day on the heat map holds. */
export type DayActivity = { meetings: number; tasks: number; approvals: number }

/** One month of activity, keyed by day of month (1-based). */
export type MonthActivity = Record<number, DayActivity>
