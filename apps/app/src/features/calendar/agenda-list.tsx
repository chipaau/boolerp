import { ChevronRight } from 'lucide-react'
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Card } from '@workspace/ui/components/card'
import { cn } from '@workspace/ui/lib/utils'
import { byStart, dayOfMonth, fmtRange, hoursLabel, minutesOf, monthShort, myRsvp, weekdayLong } from './logic'
import { HexDot, MeetingLink, RsvpBadge, useCalendarMap, usePeopleMap } from './meeting-bits'
import { useMe } from './queries'
import type { Meeting, Rsvp } from './types'

/**
 * Meetings grouped by day. In "awaiting" mode only invitations without a reply are listed and each
 * row carries Going / Maybe / No so the reply can happen from here.
 */
export function AgendaList({ meetings, today, awaiting, emptyNote, onReply }: { meetings: Meeting[]; today: string; awaiting: boolean; emptyNote: string; onReply: (m: Meeting, rsvp: Rsvp) => void }) {
  const cals = useCalendarMap()
  const people = usePeopleMap()
  const me = useMe()
  const days = [...new Set(meetings.map((m) => m.date))].sort()
  if (days.length === 0) {
    return (
      <Card className="items-center px-[30px] py-[38px] text-center">
        <div className="text-heading-sm text-foreground">Nothing scheduled</div>
        <div className="-mt-3 text-ui-sm text-muted-foreground">{emptyNote}</div>
      </Card>
    )
  }
  return (
    <div className="space-y-3.5">
      {days.map((iso) => {
        const items = meetings.filter((m) => m.date === iso).sort(byStart)
        return (
          <Card key={iso} className="gap-0 overflow-hidden py-0">
            <div className="flex items-baseline gap-3 border-b border-divider px-[22px] pt-4 pb-[13px]">
              <span className="text-title tracking-[-0.01em] text-foreground">
                {weekdayLong(iso)} {dayOfMonth(iso)} {monthShort(iso)}
              </span>
              <span className="text-compact text-muted-foreground">
                {items.length} {items.length === 1 ? 'meeting' : 'meetings'} · {hoursLabel(minutesOf(items))}
              </span>
              {iso === today && (
                <Badge variant="warning" size="sm" className="ms-auto">
                  Today
                </Badge>
              )}
            </div>
            <ul>
              {items.map((m) => (
                <li key={m.id} className="border-b border-divider last:border-b-0">
                  <MeetingLink m={m} className="grid grid-cols-[132px_9px_minmax(0,1fr)_auto] items-center gap-3.5 px-[22px] py-3.5 outline-none transition-colors duration-instant ease-bool hover:bg-surface-soft focus-visible:bg-surface-soft">
                    <span className="text-compact font-bold tabular-nums text-muted-foreground">{fmtRange(m.start, m.end)}</span>
                    <HexDot tone={cals[m.calendar].tone} />
                    <span className="min-w-0">
                      <span className={cn('block truncate text-ui-lg font-bold text-foreground', m.cancelled && 'line-through opacity-60')}>{m.title}</span>
                      <span className="mt-[3px] block text-meta text-muted-foreground">
                        {cals[m.calendar].label} · {m.room} · {m.attendees.length} people · organised by {people[m.organiser]?.name}
                      </span>
                    </span>
                    <span className="flex items-center justify-end gap-1.5">
                      {awaiting ? (
                        <>
                          {(['yes', 'maybe', 'no'] as Rsvp[]).map((v) => (
                            <Button
                              key={v}
                              variant="secondary"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                onReply(m, v)
                              }}
                            >
                              {v === 'yes' ? 'Going' : v === 'maybe' ? 'Maybe' : 'No'}
                            </Button>
                          ))}
                          <ChevronRight className="size-4 text-faint" />
                        </>
                      ) : (
                        <RsvpBadge rsvp={myRsvp(m, me.key)} hideGoing />
                      )}
                    </span>
                  </MeetingLink>
                </li>
              ))}
            </ul>
          </Card>
        )
      })}
    </div>
  )
}
