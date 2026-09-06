import { useState } from 'react'
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Checkbox } from '@workspace/ui/components/checkbox'
import { MiniCalendar } from '@workspace/ui/components/mini-calendar'
import { cn } from '@workspace/ui/lib/utils'
import type { AppDef } from '@/lib/apps'
import { useMembership } from '@/features/shell/queries'
import { useCalendarSearch } from './calendar-search'
import { ManageDialog } from './manage-dialog'
import { addMonths, firstOfMonth, meetingsOn, myRsvp, toIso } from './logic'
import { TONE } from './meeting-bits'
import { useCalendars, useMe, useMeetings } from './queries'
import type { CalendarKey } from './types'

/**
 * The Calendar app's rail: the board's month at a glance (click a day to select it), the
 * invitations waiting on you, and the calendars you can show or hide. "Manage" opens the
 * calendars dialog. State lives in the URL, so the rail and the board never disagree.
 */
export function CalendarRail(_: { app: AppDef }) {
  const { view, date, hidden, set } = useCalendarSearch()
  const meetings = useMeetings()
  const calendars = useCalendars()
  const me = useMe()
  const membership = useMembership()
  const [manage, setManage] = useState(false)
  const today = toIso(new Date())
  const awaiting = meetings.filter((m) => !hidden.includes(m.calendar) && myRsvp(m, me.key) === 'pending').length
  const marks = Object.fromEntries([...new Set(meetings.map((m) => m.date))].map((d) => [d, meetingsOn(meetings, d).length]))
  const awaitingOn = view === 'awaiting'

  function toggle(k: CalendarKey) {
    set({ hidden: hidden.includes(k) ? hidden.filter((x) => x !== k) : [...hidden, k] })
  }

  return (
    <div className="flex flex-col gap-4">
      <MiniCalendar month={firstOfMonth(date)} selected={date} today={today} marks={marks} onSelect={(iso) => set({ date: iso, view: view === 'awaiting' ? 'month' : view })} onMonthChange={(d) => set({ date: addMonths(date, d) })} className="border-b border-sidebar-border pb-3.5" />

      <button
        type="button"
        onClick={() => set({ view: awaitingOn ? 'agenda' : 'awaiting' })}
        className={cn('flex items-center justify-between gap-2.5 rounded-lg py-2 pr-3 pl-[13px] text-left text-ui outline-none transition-colors duration-instant focus-visible:ring-2 focus-visible:ring-ring', awaitingOn ? 'bg-sidebar-accent font-bold text-foreground' : 'text-body hover:bg-sidebar-hover hover:text-foreground')}
      >
        <span>Awaiting your reply</span>
        {awaiting > 0 && (
          <Badge variant="warning" size="sm">
            {awaiting}
          </Badge>
        )}
      </button>

      <div className="border-t border-sidebar-border pt-4">
        <div className="mb-2.5 flex items-center gap-2">
          <div className="text-overline text-faint">My calendars</div>
          <Button variant="link" size="xs" onClick={() => setManage(true)} className="ms-auto text-fine">
            {membership?.role === 'Admin' ? 'Manage' : 'Details'}
          </Button>
        </div>
        {calendars.map((c) => {
          const on = !hidden.includes(c.key)
          return (
            <label key={c.key} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-sidebar-hover">
              <Checkbox checked={on} onCheckedChange={() => toggle(c.key)} className={TONE[c.tone].box} indicatorClassName="dark:text-background" />
              <span className={cn('min-w-0 flex-1 text-ui-sm text-body', !on && 'opacity-55')}>{c.label}</span>
            </label>
          )
        })}
      </div>
      <ManageDialog open={manage} tab="calendars" editable={membership?.role === 'Admin'} onClose={() => setManage(false)} />
    </div>
  )
}
