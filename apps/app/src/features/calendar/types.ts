import type { BadgeTone } from '@workspace/ui/components/badge'

// Calendar resource shapes. Mirrors what the API will return; once `packages/api-client` is
// generated these become re-exports. Dates are local ISO days (YYYY-MM-DD), times are HH:MM.

export type CalendarKey = 'team' | 'client' | 'one' | 'hiring'
/** The hue a calendar (or a status) carries; one of the badge tones. */
export type Tone = BadgeTone

export type CalendarDef = {
  key: CalendarKey
  label: string
  tone: Tone
  /** Who can see meetings on it. */
  visibility: string
}

export type Room = { name: string; capacity: number; kit: string }

export type Person = { key: string; name: string; role: string; photo?: string }

export type Rsvp = 'yes' | 'no' | 'maybe' | 'pending'
export type Attendee = { person: string; rsvp: Rsvp }
export type AgendaItem = { text: string; minutes: string }

export type Meeting = {
  id: string
  title: string
  date: string
  start: string
  end: string
  calendar: CalendarKey
  room: string
  organiser: string
  /** Recurrence rule; '' when one-off. Instances are stored expanded, so the rule is descriptive for now. */
  repeats: Recurrence
  attendees: Attendee[]
  agenda: AgendaItem[]
  notes: string
  cancelled?: boolean
  /** Set once a meeting has been rescheduled from its original slot. */
  moved?: boolean
}

export type CalendarView = 'day' | 'month' | 'workweek' | 'week' | 'agenda' | 'rooms'
export type Recurrence = '' | 'Daily' | 'Weekdays' | 'Weekly' | 'Fortnightly' | 'Monthly' | 'Quarterly'

export type Swatch = { name: string; tone: Tone }
