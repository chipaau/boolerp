import { Link } from '@tanstack/react-router'
import { Avatar, AvatarFallback, AvatarImage } from '@workspace/ui/components/avatar'
import { Badge } from '@workspace/ui/components/badge'
import { cn } from '@workspace/ui/lib/utils'
import { RSVP_META, fmtRange, isTentative, longDate, myRsvp, recurrenceLabel } from './logic'
import { useCalendars, useMe, usePeople } from './queries'
import type { CalendarDef, Meeting, Person, Rsvp, Tone } from './types'

/** Tone → the utility classes a chip, dot or dashed edge needs (spelled out so Tailwind sees them). */
export const TONE: Record<Tone, { soft: string; fg: string; dot: string; border: string }> = {
  success: { soft: 'bg-tone-success-soft', fg: 'text-tone-success-foreground', dot: 'bg-tone-success', border: 'border-tone-success' },
  plum: { soft: 'bg-tone-plum-soft', fg: 'text-tone-plum-foreground', dot: 'bg-tone-plum', border: 'border-tone-plum' },
  slate: { soft: 'bg-tone-slate-soft', fg: 'text-tone-slate-foreground', dot: 'bg-tone-slate', border: 'border-tone-slate' },
  tan: { soft: 'bg-tone-tan-soft', fg: 'text-tone-tan-foreground', dot: 'bg-tone-tan', border: 'border-tone-tan' },
  warning: { soft: 'bg-tone-warning-soft', fg: 'text-tone-warning-foreground', dot: 'bg-tone-warning', border: 'border-tone-warning' },
  risk: { soft: 'bg-tone-risk-soft', fg: 'text-tone-risk-foreground', dot: 'bg-tone-risk', border: 'border-tone-risk' },
  danger: { soft: 'bg-tone-danger-soft', fg: 'text-tone-danger-foreground', dot: 'bg-tone-danger', border: 'border-tone-danger' },
  neutral: { soft: 'bg-tone-neutral-soft', fg: 'text-tone-neutral-foreground', dot: 'bg-tone-neutral', border: 'border-tone-neutral' },
  rose: { soft: 'bg-tone-rose-soft', fg: 'text-tone-rose-foreground', dot: 'bg-tone-rose', border: 'border-tone-rose' },
}

export function useCalendarMap() {
  const list = useCalendars()
  return Object.fromEntries(list.map((c) => [c.key, c])) as Record<string, CalendarDef>
}
/** People by key; a meeting may name someone the directory no longer has, so lookups are optional. */
export function usePeopleMap() {
  const list = usePeople()
  return Object.fromEntries(list.map((p) => [p.key, p])) as Partial<Record<string, Person>>
}

/** Small hex marker in a calendar's hue (the design's clip-path hexagon). */
export function HexDot({ tone, size = 9, className }: { tone: Tone; size?: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn('block shrink-0 [clip-path:polygon(50%_0%,100%_25%,100%_75%,50%_100%,0%_75%,0%_25%)]', TONE[tone].dot, className)}
      style={{ width: size, height: Math.round(size * 1.15) }}
    />
  )
}

export function PersonAvatar({ person, className, highlight = false }: { person?: Person; className?: string; highlight?: boolean }) {
  return (
    <Avatar name={person?.name ?? '?'} className={cn('size-8', className)}>
      {person?.photo && <AvatarImage src={person.photo} alt="" />}
      <AvatarFallback className={cn('text-micro', highlight && 'bg-primary text-foreground')} />
    </Avatar>
  )
}

export function RsvpBadge({ rsvp, hideGoing = false }: { rsvp: Rsvp | 'none'; hideGoing?: boolean }) {
  if (rsvp === 'none') return null
  if (hideGoing && rsvp === 'yes') return null
  const meta = RSVP_META[rsvp]
  return (
    <Badge variant={meta.tone} size="sm">
      {meta.label}
    </Badge>
  )
}

/** Where a meeting opens. */
export function MeetingLink({ m, className, children, ...props }: { m: Meeting; className?: string; children?: React.ReactNode } & Omit<React.ComponentProps<typeof Link>, 'to' | 'params' | 'search'>) {
  return (
    <Link to="/$app/$section" params={{ app: 'calendar', section: 'meetings' }} search={{ id: m.id }} className={className} {...props}>
      {children}
    </Link>
  )
}

/** The floating card shown while hovering a meeting anywhere on the board. */
export function MeetingHoverCard({ m }: { m: Meeting }) {
  const cals = useCalendarMap()
  const people = usePeopleMap()
  const me = useMe()
  const cal = cals[m.calendar]
  const r = myRsvp(m, me.key)
  const tentative = isTentative(r)
  return (
    <div className="w-[264px] space-y-2 p-0.5">
      <div className="flex items-center gap-2">
        <Badge variant={cal.tone} size="sm">
          {cal.label}
        </Badge>
        <RsvpBadge rsvp={r === 'none' ? 'pending' : r} />
      </div>
      <div className="text-ui leading-[1.3] font-bold text-pretty text-foreground">{m.title}</div>
      <div className="text-compact font-bold tabular-nums text-body">
        {longDate(m.date)} · {fmtRange(m.start, m.end)}
      </div>
      <div className="text-xs text-faint">
        {m.room} · {m.attendees.length} invited · organised by {people[m.organiser]?.name}
        {m.repeats ? ` · ${recurrenceLabel(m.repeats)}` : ''}
      </div>
      <div className="pt-1 text-fine text-faint">{tentative ? 'Dashed edge means tentative — waiting on your reply' : 'Click to open · drag in week view to move'}</div>
    </div>
  )
}
