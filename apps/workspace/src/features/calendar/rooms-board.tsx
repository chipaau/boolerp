import { Card } from '@workspace/ui/components/card'
import { Button } from '@workspace/ui/components/button'
import { Segmented, SegmentedItem } from '@workspace/ui/components/segmented'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@workspace/ui/components/tooltip'
import { cn } from '@workspace/ui/lib/utils'
import { DAY_END, DAY_START, addDays, dayOfMonth, fmtRange, fmtTime, fromMinutes, hoursLabel, roomBusy, roomGaps, startOfWeek, toMinutes, weekdayShort } from './logic'
import { MeetingHoverCard, MeetingLink, TONE, useCalendarMap } from './meeting-bits'
import { useRooms } from './queries'
import type { Meeting } from './types'

const TOTAL = (DAY_END - DAY_START) * 60
const pct = (mins: number) => ((mins - DAY_START * 60) / TOTAL) * 100
const HOURS = Array.from({ length: DAY_END - DAY_START }, (_, i) => DAY_START + i)

/**
 * Who has which room: one row per room with its bookings laid along the day and dashed "free"
 * stretches you can click to book; or a Monday-to-Friday load view that opens a day on click.
 */
export function RoomsBoard({
  meetings,
  date,
  today,
  nowMinutes,
  span,
  onSpan,
  onOpenDay,
  onBook,
  onManage,
}: {
  meetings: Meeting[]
  date: string
  today: string
  nowMinutes: number
  span: 'day' | 'week'
  onSpan: (s: 'day' | 'week') => void
  onOpenDay: (iso: string) => void
  onBook: (room: string, iso: string, start: string, duration: number) => void
  /** Admins only: opens the room list to add, edit or remove rooms. */
  onManage?: () => void
}) {
  const rooms = useRooms()
  const cals = useCalendarMap()
  const weekStart = addDays(startOfWeek(date), 1)
  const weekDays = [0, 1, 2, 3, 4].map((i) => addDays(weekStart, i))
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="flex flex-wrap items-center justify-between gap-3.5 border-b border-divider px-5 pt-4 pb-3.5">
        <div>
          <div className="text-body-lg font-bold tracking-[-0.01em] text-foreground">{span === 'day' ? 'Who has which room today' : 'Room load, Monday to Friday'}</div>
          <div className="mt-1 text-meta text-muted-foreground">{span === 'day' ? 'Dashed blocks are free — click one to book it.' : 'Click any day to open its hour-by-hour grid.'}</div>
        </div>
        <div className="flex items-center gap-[9px]">
          {onManage ? (
            <Button variant="link" size="xs" onClick={onManage} className="text-fine">
              Manage rooms
            </Button>
          ) : (
            <span className="text-fine text-faint">Capacity set by admins</span>
          )}
          <Segmented>
            <SegmentedItem active={span === 'day'} onClick={() => onSpan('day')}>
              Day
            </SegmentedItem>
            <SegmentedItem active={span === 'week'} onClick={() => onSpan('week')}>
              Week
            </SegmentedItem>
          </Segmented>
        </div>
      </div>

      {span === 'day' ? (
        <TooltipProvider delay={200}>
          <div className="grid grid-cols-[150px_minmax(0,1fr)] bg-surface-band">
            <div className="px-3.5 py-[9px] text-[10.5px] font-bold tracking-[0.11em] text-faint uppercase">Room</div>
            <div className="relative h-[34px]">
              {HOURS.map((h) => (
                <div key={h} className="absolute top-[11px] pl-1.5 text-[10.5px] tabular-nums text-faint" style={{ left: `${pct(h * 60)}%` }}>
                  {fmtTime(`${String(h).padStart(2, '0')}:00`)}
                </div>
              ))}
            </div>
          </div>
          {rooms.map((room) => {
            const busy = roomBusy(meetings, room.name, date)
            return (
              <div key={room.name} className="grid grid-cols-[150px_minmax(0,1fr)] border-t border-divider">
                <div className="px-3.5 py-3">
                  <div className="text-ui-sm font-bold text-foreground">{room.name}</div>
                  <div className="mt-[3px] text-fine text-faint">
                    {room.capacity} seats · {room.kit}
                  </div>
                </div>
                <div className="relative h-[58px]">
                  {HOURS.map((h) => (
                    <div key={h} className="absolute top-0 bottom-0 w-0 border-l border-divider" style={{ left: `${pct(h * 60)}%` }} />
                  ))}
                  {roomGaps(busy).map(([s, e]) => (
                    <button
                      key={s}
                      type="button"
                      title={`Book ${room.name} at ${fmtTime(fromMinutes(s))}`}
                      onClick={() => onBook(room.name, date, fromMinutes(s), Math.min(60, e - s))}
                      className="absolute top-2 bottom-2 overflow-hidden rounded-lg border border-dashed border-border px-2 text-left text-[10.5px] font-bold whitespace-nowrap text-faint outline-none transition-colors duration-instant hover:bg-surface-soft focus-visible:ring-2 focus-visible:ring-ring"
                      style={{ left: `calc(${pct(s)}% + 2px)`, width: `calc(${((e - s) / TOTAL) * 100}% - 4px)` }}
                    >
                      {e - s >= 90 ? `Free from ${fmtTime(fromMinutes(s))}` : 'Free'}
                    </button>
                  ))}
                  {busy.map((m) => {
                    const t = TONE[cals[m.calendar].tone]
                    return (
                      <Tooltip key={m.id}>
                        <TooltipTrigger
                          render={<MeetingLink m={m} />}
                          className={cn('absolute top-2 bottom-2 overflow-hidden rounded-lg px-[9px] py-1.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring', t.soft)}
                          style={{ left: `calc(${pct(toMinutes(m.start))}% + 2px)`, width: `calc(${((toMinutes(m.end) - toMinutes(m.start)) / TOTAL) * 100}% - 4px)` }}
                        >
                          <span className={cn('block truncate text-fine font-bold', t.fg)}>{m.title}</span>
                          <span className={cn('mt-0.5 block truncate text-[10.5px] opacity-80', t.fg)}>{fmtRange(m.start, m.end)}</span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" align="start" sideOffset={8} variant="card" showArrow={false}>
                          <MeetingHoverCard m={m} />
                        </TooltipContent>
                      </Tooltip>
                    )
                  })}
                  {date === today && <div aria-hidden="true" className="absolute top-0 bottom-0 z-[6] w-0 border-l-[1.5px] border-tone-risk" style={{ left: `${pct(nowMinutes)}%` }} />}
                </div>
              </div>
            )
          })}
        </TooltipProvider>
      ) : (
        <>
          <div className="grid grid-cols-[150px_repeat(5,minmax(0,1fr))] bg-surface-band">
            <div className="px-3.5 py-[9px] text-[10.5px] font-bold tracking-[0.11em] text-faint uppercase">Room</div>
            {weekDays.map((iso) => (
              <div key={iso} className={cn('border-l border-divider px-3 py-[9px] text-[10.5px] font-bold tracking-[0.09em] uppercase', iso === today ? 'text-tone-warning-foreground' : 'text-faint')}>
                {weekdayShort(iso)} {dayOfMonth(iso)}
              </div>
            ))}
          </div>
          {rooms.map((room) => (
            <div key={room.name} className="grid grid-cols-[150px_repeat(5,minmax(0,1fr))] border-t border-divider">
              <div className="px-3.5 py-3">
                <div className="text-ui-sm font-bold text-foreground">{room.name}</div>
                <div className="mt-[3px] text-fine text-faint">
                  {room.capacity} seats · {room.kit}
                </div>
              </div>
              {weekDays.map((iso) => {
                const busy = roomBusy(meetings, room.name, iso)
                const used = busy.reduce((n, m) => n + toMinutes(m.end) - toMinutes(m.start), 0)
                return (
                  <button key={iso} type="button" onClick={() => onOpenDay(iso)} className={cn('border-l border-divider px-3 py-[13px] text-left outline-none hover:bg-surface-soft focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset', iso === today && 'bg-surface-soft/60')}>
                    <div className="relative h-[7px] overflow-hidden rounded-full bg-muted">
                      {busy.map((m) => (
                        <span key={m.id} className={cn('absolute top-0 bottom-0', TONE[cals[m.calendar].tone].dot)} style={{ left: `${pct(toMinutes(m.start))}%`, width: `${((toMinutes(m.end) - toMinutes(m.start)) / TOTAL) * 100}%` }} />
                      ))}
                    </div>
                    <div className={cn('mt-2 text-micro', busy.length ? 'text-muted-foreground' : 'text-faint')}>{busy.length ? `${busy.length} booked · ${hoursLabel(TOTAL - used)} free` : 'Free all day'}</div>
                  </button>
                )
              })}
            </div>
          ))}
        </>
      )}
    </Card>
  )
}
