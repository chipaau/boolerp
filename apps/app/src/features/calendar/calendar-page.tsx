import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, SlidersHorizontal } from 'lucide-react'
import { Button, ButtonArrow } from '@workspace/ui/components/button'
import { Checkbox } from '@workspace/ui/components/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@workspace/ui/components/popover'
import { Segmented, SegmentedItem } from '@workspace/ui/components/segmented'
import { useToast } from '@workspace/ui/components/toast'
import { cn } from '@workspace/ui/lib/utils'
import { AgendaList } from './agenda-list'
import { useCalendarSearch } from './calendar-search'
import { DayPanel } from './day-panel'
import { DAY_END, DAY_START, VIEWS, addDays, addMonths, dayOfMonth, fmtTime, hoursLabel, longDate, minutesOf, monthShort, monthYear, myRsvp, rangeTitle, roomBusy, roomGaps, sameMonth, shortDate, startOfWeek, toIso, visibleMeetings } from './logic'
import { usePeopleMap } from './meeting-bits'
import { MonthGrid } from './month-grid'
import { NewMeetingDialog  } from './new-meeting-dialog'
import type {NewMeetingDraft} from './new-meeting-dialog';
import { useMe, useMeetingActions, useMeetings, useRooms } from './queries'
import { RoomsBoard } from './rooms-board'
import type { Meeting, Rsvp } from './types'
import { WeekGrid } from './week-grid'

/**
 * The Calendar board: a sticky command bar (Today · ‹ ›, view tabs, filters, New meeting), the
 * period title, then the view with the day panel beside it. Which view, which day and which
 * calendars are hidden all live in the URL; the rail reads the same state.
 */
export function CalendarPage() {
  const { view, date, hidden, mine, declined, set } = useCalendarSearch()
  const meetings = useMeetings()
  const rooms = useRooms()
  const me = useMe()
  const people = usePeopleMap()
  const actions = useMeetingActions()
  const toast = useToast()
  const [draft, setDraft] = useState<NewMeetingDraft | null>(null)
  const [roomsSpan, setRoomsSpan] = useState<'day' | 'week'>('day')
  const today = toIso(new Date())

  const visible = useMemo(
    () => visibleMeetings(meetings, { hidden, mine, declined, query: '' }, me.key, (k) => people[k]?.name ?? ''),
    [meetings, hidden, mine, declined, me.key, people]
  )

  const boardView = view === 'awaiting' ? 'agenda' : view
  const weekish = boardView === 'day' || boardView === 'week' || boardView === 'workweek'
  const days = boardView === 'day' ? 1 : boardView === 'workweek' ? 5 : 7
  const weekStart = boardView === 'day' ? date : boardView === 'workweek' ? addDays(startOfWeek(date), 1) : startOfWeek(date)
  const weekEnd = addDays(weekStart, days - 1)
  const weekList = visible.filter((m) => m.date >= weekStart && m.date <= weekEnd)
  const monthList = visible.filter((m) => sameMonth(m.date, date))
  const awaitingList = visible.filter((m) => myRsvp(m, me.key) === 'pending' && m.date >= today)
  const filterCount = (declined ? 1 : 0) + (mine ? 1 : 0) + hidden.length

  const roomStats = useMemo(() => {
    let booked = 0, free = 0
    for (const r of rooms) {
      const busy = roomBusy(meetings, r.name, date)
      booked += busy.length
      free += roomGaps(busy).reduce((n, [s, e]) => n + (e - s), 0)
    }
    return { booked, free }
  }, [rooms, meetings, date])

  const title =
    boardView === 'rooms'
      ? roomsSpan === 'day' ? longDate(date) : `Week of ${dayOfMonth(addDays(startOfWeek(date), 1))} ${monthShort(addDays(startOfWeek(date), 1))}`
      : boardView === 'day' ? longDate(date) : weekish ? rangeTitle(weekStart, weekEnd) : monthYear(date)
  const subtitle =
    boardView === 'rooms'
      ? roomsSpan === 'day' ? `${rooms.length} rooms · ${roomStats.booked} bookings · ${hoursLabel(roomStats.free)} free across the day` : `${rooms.length} rooms · Monday to Friday · click a day to open it`
      : view === 'awaiting' ? `${awaitingList.length} invitations waiting on you`
      : weekish ? `${weekList.length} ${weekList.length === 1 ? 'meeting' : 'meetings'} · ${hoursLabel(minutesOf(weekList))} booked`
      : `${monthList.length} meetings this month · all shared calendars`

  function step(dir: 1 | -1) {
    if (boardView === 'day') set({ date: addDays(date, dir) })
    else if (weekish) set({ date: addDays(date, 7 * dir) })
    else if (boardView === 'rooms') set({ date: addDays(date, (roomsSpan === 'week' ? 7 : 1) * dir) })
    else set({ date: addMonths(date, dir) })
  }

  function reply(m: Meeting, rsvp: Rsvp) {
    actions.setRsvp(m.id, me.key, rsvp)
    toast(rsvp === 'yes' ? `Going to ${m.title}` : rsvp === 'maybe' ? `Maybe for ${m.title}` : `Declined ${m.title}`, { ok: rsvp !== 'no' })
  }
  function move(m: Meeting, toDate: string, start: string, end: string) {
    const undo = actions.move(m.id, toDate, start, end)
    toast(`Moved to ${shortDate(toDate)}, ${fmtTime(start)}`, { undo: () => { undo(); toast('Move undone') } })
  }

  // d / m / w / e / a / r switch views, t is today, n a new meeting, arrows step the period
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName ?? ''
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || e.metaKey || e.ctrlKey || draft) return
      const k = e.key.toLowerCase()
      if (k === 'd') set({ view: 'day' })
      else if (k === 'm') set({ view: 'month' })
      else if (k === 'w') set({ view: 'week' })
      else if (k === 'e') set({ view: 'workweek' })
      else if (k === 'a') set({ view: 'agenda' })
      else if (k === 'r') set({ view: 'rooms' })
      else if (k === 't') set({ date: today })
      else if (k === 'n') { e.preventDefault(); setDraft({ date, start: '16:00', duration: 45 }) }
      else if (e.key === 'ArrowLeft') step(-1)
      else if (e.key === 'ArrowRight') step(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const split = boardView === 'month' || weekish

  return (
    <div className="min-h-0 w-full overflow-y-auto">
      <div className="px-8 pb-24">
        <div className="sticky top-0 z-20 -mx-8 mb-[22px] flex flex-wrap items-center gap-2.5 border-b border-divider bg-card px-8 py-[13px]">
          <Segmented>
            <SegmentedItem active={false} className="font-bold text-foreground" onClick={() => set({ date: today })}>
              Today
            </SegmentedItem>
            <SegmentedItem aria-label="Previous" className="w-[30px] px-0" onClick={() => step(-1)}>
              <ChevronLeft className="size-3.5" strokeWidth={1.7} />
            </SegmentedItem>
            <SegmentedItem aria-label="Next" className="w-[30px] px-0" onClick={() => step(1)}>
              <ChevronRight className="size-3.5" strokeWidth={1.7} />
            </SegmentedItem>
          </Segmented>
          <span aria-hidden="true" className="h-[22px] w-px bg-border" />
          <div className="flex items-center">
            {VIEWS.map((v) => (
              <button
                key={v.key}
                type="button"
                title={v.hint}
                onClick={() => set({ view: v.key })}
                className={cn('relative me-4 h-[34px] px-[3px] text-ui-sm whitespace-nowrap outline-none transition-colors duration-instant focus-visible:ring-2 focus-visible:ring-ring', boardView === v.key && view !== 'awaiting' ? 'font-bold text-foreground shadow-[inset_0_-2px_0_var(--brand-soft)]' : 'text-muted-foreground hover:text-foreground')}
              >
                {v.label}
              </button>
            ))}
          </div>
          <Popover>
            <PopoverTrigger
              title={filterCount ? `${filterCount} filter${filterCount === 1 ? '' : 's'} applied` : 'Filter'}
              className={cn('relative grid size-[34px] place-items-center rounded-full outline-none transition-colors duration-instant focus-visible:ring-2 focus-visible:ring-ring', filterCount ? 'bg-tone-warning-soft text-tone-warning-foreground' : 'text-body shadow-[inset_0_0_0_1px_var(--divider)] hover:bg-surface-soft')}
            >
              <SlidersHorizontal className="size-[15px]" strokeWidth={1.6} />
              {filterCount > 0 && <span className="absolute -top-[3px] -right-[3px] grid h-4 min-w-4 place-items-center rounded-full bg-brand-soft px-1 text-[10px] font-bold text-brand-cta-foreground">{filterCount}</span>}
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[262px] p-2.5">
              <label className="flex cursor-pointer items-center gap-[11px] rounded-[9px] px-3 py-[9px] hover:bg-surface-soft">
                <Checkbox checked={declined} onCheckedChange={(v) => set({ declined: !!v })} />
                <span className="text-ui-sm text-body">Hide declined meetings</span>
              </label>
              <label className="flex cursor-pointer items-center gap-[11px] rounded-[9px] px-3 py-[9px] hover:bg-surface-soft">
                <Checkbox checked={mine} onCheckedChange={(v) => set({ mine: !!v })} />
                <span className="text-ui-sm text-body">Only meetings I organise</span>
              </label>
              <div className="mt-1.5 border-t border-divider pt-2">
                <button type="button" disabled={!filterCount} onClick={() => set({ mine: false, declined: false, hidden: [] })} className="w-full rounded-[9px] px-3 py-2 text-left text-compact text-link hover:bg-surface-soft disabled:opacity-50">
                  Clear all filters
                </button>
              </div>
            </PopoverContent>
          </Popover>
          <span className="flex-1" />
          <Button onClick={() => setDraft({ date, start: '16:00', duration: 45 })}>
            New meeting
            <ButtonArrow>
              <Plus strokeWidth={2.2} />
            </ButtonArrow>
          </Button>
        </div>

        <div className="mb-5">
          <h1 className="text-[23px] font-medium tracking-[-0.018em] text-foreground">{title}</h1>
          <div className="mt-[7px] text-ui-sm text-muted-foreground">{subtitle}</div>
        </div>

        <div className={cn(split && 'grid items-start gap-[18px] xl:grid-cols-[minmax(0,1fr)_328px]')}>
          <div className="min-w-0">
            {boardView === 'month' && <MonthGrid meetings={visible} month={date} selected={date} today={today} onSelect={(d) => set({ date: d })} onCreate={(d) => setDraft({ date: d, start: '16:00', duration: 45 })} />}
            {weekish && (
              <WeekGrid
                meetings={visible}
                start={weekStart}
                days={days}
                selected={date}
                today={today}
                nowMinutes={me.nowMinutes}
                onSelect={(d) => set({ date: d })}
                onCreate={(d, start, duration) => setDraft({ date: d, start, duration })}
                onMove={move}
              />
            )}
            {boardView === 'agenda' && (
              <AgendaList
                meetings={view === 'awaiting' ? awaitingList : monthList}
                today={today}
                awaiting={view === 'awaiting'}
                emptyNote={view === 'awaiting' ? 'Every invitation has an answer. Rare and good.' : 'Nothing on the calendar for this month yet.'}
                onReply={reply}
              />
            )}
            {boardView === 'rooms' && (
              <RoomsBoard
                meetings={meetings}
                date={date}
                today={today}
                nowMinutes={me.nowMinutes}
                span={roomsSpan}
                onSpan={setRoomsSpan}
                onOpenDay={(d) => { set({ date: d }); setRoomsSpan('day') }}
                onBook={(room, d, start, duration) => setDraft({ date: d, start, duration, room })}
              />
            )}
          </div>
          {split && <DayPanel meetings={visible} date={date} today={today} onCreate={() => setDraft({ date, start: `${String(DAY_START + 1).padStart(2, '0')}:00`, duration: 30 })} />}
        </div>
      </div>
      <NewMeetingDialog draft={draft} today={today} onClose={() => setDraft(null)} />
      {/* keeps DAY_END referenced for the all-day range shown in the dialog footer */}
      <span hidden>{DAY_END}</span>
    </div>
  )
}
