import { Plus, Repeat } from 'lucide-react'
import { Card } from '@workspace/ui/components/card'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@workspace/ui/components/tooltip'
import { cn } from '@workspace/ui/lib/utils'
import { dayOfMonth, fmtTime, isTentative, isWeekend, meetingsOn, monthGrid, myRsvp, sameMonth } from './logic'
import { MeetingHoverCard, MeetingLink, TONE, useCalendarMap } from './meeting-bits'
import { useMe } from './queries'
import type { Meeting } from './types'

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MAX_CHIPS = 3

/**
 * Six weeks of days, Sunday first. Today wears the amber disc, the selected day an amber inset
 * ring, weekends a softer fill, other months at half strength. Each day lists up to three meeting
 * chips in their calendar's hue (dashed when tentative) and a "+n more".
 */
export function MonthGrid({
  meetings,
  month,
  selected,
  today,
  onSelect,
  onCreate,
}: {
  meetings: Meeting[]
  month: string
  selected: string
  today: string
  onSelect: (iso: string) => void
  onCreate: (iso: string) => void
}) {
  const cals = useCalendarMap()
  const me = useMe()
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="grid grid-cols-7 border-b border-divider bg-surface-band">
        {DOW.map((d, i) => (
          <div key={d} className={cn('px-3 py-[11px] text-micro font-bold tracking-[0.1em] text-muted-foreground uppercase', i < 6 && 'border-r border-divider')}>
            {d}
          </div>
        ))}
      </div>
      <TooltipProvider delay={200}>
        <div className="grid grid-cols-7">
          {monthGrid(month).map((iso, i) => {
            const inMonth = sameMonth(iso, month)
            const isToday = iso === today
            const isSelected = iso === selected
            const items = meetingsOn(meetings, iso)
            return (
              <div
                key={iso}
                role="button"
                tabIndex={0}
                onClick={() => onSelect(iso)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onSelect(iso)
                  }
                }}
                className={cn(
                  'group/cell min-h-[136px] cursor-pointer border-b border-divider p-[9px] pt-[9px] pb-2.5 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                  (i + 1) % 7 !== 0 && 'border-r',
                  isSelected ? 'bg-surface-soft shadow-[inset_0_0_0_1.5px_var(--brand-soft)]' : isWeekend(iso) && 'bg-surface-band/60',
                  !inMonth && 'opacity-50'
                )}
              >
                <div className="flex items-center justify-between gap-1.5">
                  <span
                    className={cn(
                      'grid size-[26px] place-items-center rounded-full text-compact tabular-nums',
                      isToday ? 'bg-brand-soft font-bold text-brand-cta-foreground' : inMonth ? 'font-bold text-foreground' : 'text-muted-foreground'
                    )}
                  >
                    {dayOfMonth(iso)}
                  </span>
                  <button
                    type="button"
                    aria-label="New meeting"
                    title="New meeting"
                    onClick={(e) => {
                      e.stopPropagation()
                      onCreate(iso)
                    }}
                    className="grid size-[18px] place-items-center rounded-full bg-muted text-faint opacity-0 transition-opacity duration-instant group-hover/cell:opacity-100 hover:text-foreground focus-visible:opacity-100"
                  >
                    <Plus className="size-3" strokeWidth={2} />
                  </button>
                </div>
                <div className="mt-1.5 flex flex-col gap-[3px]">
                  {items.slice(0, MAX_CHIPS).map((m) => {
                    const t = TONE[cals[m.calendar].tone]
                    const tentative = !m.cancelled && isTentative(myRsvp(m, me.key))
                    return (
                      <Tooltip key={m.id}>
                        <TooltipTrigger
                          render={<MeetingLink m={m} onClick={(e) => e.stopPropagation()} />}
                          className={cn(
                            'flex items-center gap-1.5 overflow-hidden rounded-[6px] border py-0.5 pr-1.5 pl-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            tentative ? cn('border-dashed bg-transparent', t.border) : cn('border-transparent', t.soft),
                            m.cancelled && 'opacity-60'
                          )}
                        >
                          <span className={cn('shrink-0 text-[10.5px] tabular-nums opacity-85', t.fg)}>{fmtTime(m.start)}</span>
                          <span className={cn('min-w-0 truncate text-fine font-bold', t.fg, m.cancelled && 'line-through')}>{m.title}</span>
                          {m.repeats && <Repeat className={cn('ms-auto size-2.5 shrink-0 opacity-55', t.fg)} strokeWidth={2} />}
                        </TooltipTrigger>
                        <TooltipContent side="right" align="start" sideOffset={8} variant="card" showArrow={false}>
                          <MeetingHoverCard m={m} />
                        </TooltipContent>
                      </Tooltip>
                    )
                  })}
                  {items.length > MAX_CHIPS && <span className="pl-1.5 text-micro font-bold text-faint">+{items.length - MAX_CHIPS} more</span>}
                </div>
              </div>
            )
          })}
        </div>
      </TooltipProvider>
    </Card>
  )
}
