import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Card } from '@workspace/ui/components/card'
import { cn } from '@workspace/ui/lib/utils'
import { dayOfMonth, fmtRange, hoursLabel, meetingsOn, minutesOf, monthLong, myRsvp, toMinutes, weekdayLong } from './logic'
import { HexDot, MeetingLink, RsvpBadge, useCalendarMap } from './meeting-bits'
import { useMe } from './queries'
import type { Meeting } from './types'

/** The selected day beside the month grid: date, load, and its meetings in order; today's finished ones fade. */
export function DayPanel({ meetings, date, today, nowMinutes, onCreate }: { meetings: Meeting[]; date: string; today: string; nowMinutes: number; onCreate: () => void }) {
  const cals = useCalendarMap()
  const me = useMe()
  const items = meetingsOn(meetings, date)
  const mins = minutesOf(items)
  return (
    <Card className="sticky top-[130px] gap-0 overflow-hidden py-0">
      <div className="border-b border-divider px-5 pt-[18px] pb-[15px]">
        <div className="flex items-start justify-between gap-2.5">
          <div>
            <div className="text-[10.5px] font-bold tracking-[0.13em] text-faint uppercase">{weekdayLong(date)}</div>
            <div className="mt-[5px] text-[23px] font-medium tracking-[-0.02em] text-foreground">
              {dayOfMonth(date)} {monthLong(date)}
            </div>
          </div>
          {date === today && (
            <Badge variant="warning" size="sm">
              Today
            </Badge>
          )}
        </div>
        <div className="mt-[9px] text-meta text-muted-foreground">
          {items.length ? `${items.length} ${items.length === 1 ? 'meeting' : 'meetings'} · ${hoursLabel(mins)} booked` : 'No meetings scheduled'}
        </div>
      </div>
      <div className="max-h-[calc(100svh-300px)] overflow-y-auto p-2">
        {items.map((m) => (
          <MeetingLink key={m.id} m={m} className={cn('flex gap-[11px] rounded-[11px] px-3 py-[11px] outline-none transition-colors duration-instant ease-hexa hover:bg-surface-soft focus-visible:bg-surface-soft', date === today && toMinutes(m.end) < nowMinutes && 'opacity-55 hover:opacity-100')}>
            <HexDot tone={cals[m.calendar].tone} size={8} className="mt-1" />
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-bold tabular-nums text-muted-foreground">{fmtRange(m.start, m.end)}</span>
              <span className={cn('mt-[3px] block text-sm font-bold text-foreground', m.cancelled && 'line-through opacity-60')}>{m.title}</span>
              <span className="mt-[3px] block text-xs text-faint">
                {m.room} · {m.attendees.length} people
              </span>
            </span>
            <span className="self-start">
              <RsvpBadge rsvp={myRsvp(m, me.key)} hideGoing />
            </span>
          </MeetingLink>
        ))}
        {items.length === 0 && (
          <div className="px-3.5 pt-[26px] pb-[30px] text-center">
            <div className="text-ui-sm text-body">No meetings — a clear day.</div>
            <Button variant="outline" size="sm" className="mt-3" onClick={onCreate}>
              Schedule something
            </Button>
          </div>
        )}
      </div>
    </Card>
  )
}
