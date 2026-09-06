import { useState } from 'react'
import { CalendarDays, MailQuestion, Tags } from 'lucide-react'
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Checkbox } from '@workspace/ui/components/checkbox'
import { MiniCalendar } from '@workspace/ui/components/mini-calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@workspace/ui/components/popover'
import { useSidebar } from '@workspace/ui/components/sidebar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@workspace/ui/components/tooltip'
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
 * calendars dialog. State lives in the URL, so the rail and the board never disagree. When the
 * sidebar is collapsed the same three things become icons: the month opens in a popover, the
 * envelope carries the awaiting count, the tags open the calendar toggles.
 */
export function CalendarRail(_: { app: AppDef }) {
  const { view, date, hidden, set } = useCalendarSearch()
  const meetings = useMeetings()
  const calendars = useCalendars()
  const me = useMe()
  const membership = useMembership()
  const [manage, setManage] = useState(false)
  const collapsed = useSidebar().state === 'collapsed'
  const today = toIso(new Date())
  const awaiting = meetings.filter((m) => !hidden.includes(m.calendar) && myRsvp(m, me.key) === 'pending').length
  const marks = Object.fromEntries([...new Set(meetings.map((m) => m.date))].map((d) => [d, meetingsOn(meetings, d).length]))
  const awaitingOn = view === 'awaiting'

  function toggle(k: CalendarKey) {
    set({ hidden: hidden.includes(k) ? hidden.filter((x) => x !== k) : [...hidden, k] })
  }

  const mini = (compact: boolean) => (
    <MiniCalendar compact={compact} month={firstOfMonth(date)} selected={date} today={today} marks={marks} onSelect={(iso) => set({ date: iso, view: view === 'awaiting' ? 'month' : view })} onMonthChange={(d) => set({ date: addMonths(date, d) })} className={cn(!compact && 'border-b border-sidebar-border pb-3.5')} />
  )

  function CalendarToggles() {
    return (
      <>
        {calendars.map((c) => {
          const on = !hidden.includes(c.key)
          return (
            <label key={c.key} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-sidebar-hover">
              <Checkbox checked={on} onCheckedChange={() => toggle(c.key)} className={TONE[c.tone].box} indicatorClassName="dark:text-background" />
              <span className={cn('min-w-0 flex-1 text-ui-sm text-body', !on && 'opacity-55')}>{c.label}</span>
            </label>
          )
        })}
      </>
    )
  }

  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-1.5">
        <Popover>
          <Tooltip>
            <TooltipTrigger render={<PopoverTrigger render={<Button variant="ghost" size="icon-sm" />} />} aria-label="Pick a day" className="text-body">
              <CalendarDays strokeWidth={1.75} />
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              Pick a day
            </TooltipContent>
          </Tooltip>
          <PopoverContent side="right" align="start" sideOffset={10} className="w-[252px] p-3">
            {mini(true)}
          </PopoverContent>
        </Popover>
        <Tooltip>
          <TooltipTrigger render={<Button variant={awaitingOn ? 'secondary' : 'ghost'} size="icon-sm" />} aria-label={`Awaiting your reply${awaiting ? `, ${awaiting}` : ''}`} onClick={() => set({ view: awaitingOn ? 'agenda' : 'awaiting' })} className="relative text-body">
            <MailQuestion strokeWidth={1.75} />
            {awaiting > 0 && <span className="absolute -top-0.5 -right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-tone-warning-soft px-1 text-[10px] font-bold text-tone-warning-foreground">{awaiting}</span>}
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={8}>
            {awaiting ? `Awaiting your reply · ${awaiting}` : 'Awaiting your reply'}
          </TooltipContent>
        </Tooltip>
        <Popover>
          <Tooltip>
            <TooltipTrigger render={<PopoverTrigger render={<Button variant="ghost" size="icon-sm" />} />} aria-label="My calendars" className="text-body">
              <Tags strokeWidth={1.75} />
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              My calendars
            </TooltipContent>
          </Tooltip>
          <PopoverContent side="right" align="start" sideOffset={10} className="w-[216px] p-2">
            <div className="px-2 pt-1 pb-1.5 text-overline text-faint">My calendars</div>
            <CalendarToggles />
          </PopoverContent>
        </Popover>
        <ManageDialog open={manage} tab="calendars" editable={membership?.role === 'Admin'} onClose={() => setManage(false)} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {mini(false)}

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
        <CalendarToggles />
      </div>
      <ManageDialog open={manage} tab="calendars" editable={membership?.role === 'Admin'} onClose={() => setManage(false)} />
    </div>
  )
}
