import { useState } from 'react'
import { CalendarDays, MailQuestion, Tags } from 'lucide-react'
import { Button } from '@workspace/ui/components/button'
import { Checkbox } from '@workspace/ui/components/checkbox'
import { MiniCalendar } from '@workspace/ui/components/mini-calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@workspace/ui/components/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@workspace/ui/components/tooltip'
import { SidebarNavGroups, SidebarSection } from '@workspace/ui/components/workspace-sidebar'
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
 * calendars dialog. State lives in the URL, so the rail and the board never disagree. Folded to
 * icons, the month and the calendar toggles open in popovers; the awaiting row keeps its icon.
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

  const mini = (compact: boolean) => (
    <MiniCalendar compact={compact} month={firstOfMonth(date)} selected={date} today={today} marks={marks} onSelect={(iso) => set({ date: iso, view: view === 'awaiting' ? 'month' : view })} onMonthChange={(d) => set({ date: addMonths(date, d) })} />
  )

  const toggles = calendars.map((c) => {
    const on = !hidden.includes(c.key)
    return (
      <label key={c.key} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-sidebar-hover">
        <Checkbox checked={on} onCheckedChange={() => toggle(c.key)} className={TONE[c.tone].box} indicatorClassName="dark:text-background" />
        <span className={cn('min-w-0 flex-1 text-ui-sm text-body', !on && 'opacity-55')}>{c.label}</span>
      </label>
    )
  })

  // the folded rail's popover buttons
  const pop = (label: string, icon: React.ReactNode, width: string, content: React.ReactNode) => (
    <Popover>
      <Tooltip>
        <TooltipTrigger render={<PopoverTrigger render={<Button variant="ghost" size="icon-sm" />} />} aria-label={label} className="text-body">
          {icon}
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          {label}
        </TooltipContent>
      </Tooltip>
      <PopoverContent side="right" align="start" sideOffset={10} className={width}>
        {content}
      </PopoverContent>
    </Popover>
  )

  return (
    <>
      <SidebarSection collapsed={pop('Pick a day', <CalendarDays strokeWidth={1.75} />, 'w-[252px] p-3', mini(true))}>{mini(false)}</SidebarSection>
      <SidebarNavGroups
        groups={[
          {
            items: [
              {
                key: 'awaiting',
                title: 'Awaiting your reply',
                icon: MailQuestion,
                render: <button type="button" onClick={() => set({ view: awaitingOn ? 'agenda' : 'awaiting' })} />,
                active: awaitingOn,
                count: awaiting > 0 ? awaiting : undefined,
                countTone: 'warning',
              },
            ],
          },
        ]}
      />
      <SidebarSection
        title="My calendars"
        action={
          <Button variant="link" size="xs" onClick={() => setManage(true)} className="text-fine">
            {membership?.role === 'Admin' ? 'Manage' : 'Details'}
          </Button>
        }
        collapsed={pop(
          'My calendars',
          <Tags strokeWidth={1.75} />,
          'w-[216px] p-2',
          <>
            <div className="px-2 pt-1 pb-1.5 text-overline text-faint">My calendars</div>
            {toggles}
          </>,
        )}
      >
        {toggles}
      </SidebarSection>
      <ManageDialog open={manage} tab="calendars" editable={membership?.role === 'Admin'} onClose={() => setManage(false)} />
    </>
  )
}
