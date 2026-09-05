import { useRef, useState } from 'react'
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
 * chips in their calendar's hue (dashed when tentative) and a "+n more". Drag a chip you organise
 * onto another day to move it there, keeping its time; Escape abandons the drag.
 */
export function MonthGrid({
  meetings,
  month,
  selected,
  today,
  onSelect,
  onCreate,
  onMove,
}: {
  meetings: Meeting[]
  month: string
  selected: string
  today: string
  onSelect: (iso: string) => void
  onCreate: (iso: string) => void
  onMove: (m: Meeting, date: string) => void
}) {
  const cals = useCalendarMap()
  const me = useMe()
  const [drag, setDrag] = useState<{ id: string; over: string } | null>(null)
  const dragRef = useRef<{ id: string; over: string } | null>(null)
  const suppressClick = useRef(0)

  function startMove(m: Meeting, e: React.PointerEvent<HTMLElement>) {
    if (e.button !== 0 || m.organiser !== me.key) return
    const x0 = e.clientX, y0 = e.clientY
    let dragged = false
    const setD = (d: { id: string; over: string } | null) => {
      dragRef.current = d
      setDrag(d)
    }
    const move = (ev: PointerEvent) => {
      if (Math.abs(ev.clientX - x0) > 4 || Math.abs(ev.clientY - y0) > 4) dragged = true
      if (!dragged) return
      const over = document.elementFromPoint(ev.clientX, ev.clientY)?.closest<HTMLElement>('[data-day]')?.dataset.day
      setD({ id: m.id, over: over ?? m.date })
    }
    const stop = () => {
      document.removeEventListener('pointermove', move)
      document.removeEventListener('pointerup', up)
      document.removeEventListener('keydown', key)
    }
    const up = () => {
      stop()
      const d = dragRef.current
      setD(null)
      if (!dragged || !d) return
      suppressClick.current = Date.now()
      if (d.over !== m.date) onMove(m, d.over)
    }
    const key = (ev: KeyboardEvent) => {
      if (ev.key !== 'Escape') return
      stop()
      if (dragged) suppressClick.current = Date.now()
      setD(null)
    }
    document.addEventListener('pointermove', move)
    document.addEventListener('pointerup', up)
    document.addEventListener('keydown', key)
  }
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
                data-day={iso}
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
                  isSelected || drag?.over === iso ? 'bg-surface-soft shadow-[inset_0_0_0_1.5px_var(--brand-soft)]' : isWeekend(iso) && 'bg-surface-band/60',
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
                          render={
                            <MeetingLink
                              m={m}
                              onPointerDown={(e) => startMove(m, e)}
                              onClick={(e) => {
                                e.stopPropagation()
                                if (Date.now() - suppressClick.current < 300) e.preventDefault()
                              }}
                            />
                          }
                          style={{ touchAction: 'none' }}
                          className={cn(
                            'flex items-center gap-1.5 overflow-hidden rounded-[6px] border py-0.5 pr-1.5 pl-1 text-left outline-none select-none focus-visible:ring-2 focus-visible:ring-ring',
                            tentative ? cn('border-dashed bg-transparent', t.border) : cn('border-transparent', t.soft),
                            m.organiser === me.key ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
                            m.cancelled && 'opacity-60',
                            drag?.id === m.id && 'opacity-40'
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
