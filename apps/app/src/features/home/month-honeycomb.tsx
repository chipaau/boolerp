import { useState, type CSSProperties } from 'react'
import { Link } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { ArrowButton } from '@workspace/ui/components/arrow-button'
import { Button } from '@workspace/ui/components/button'
import { Hexagon } from '@workspace/ui/components/hexagon'
import { Honeycomb, HoneycombItem } from '@workspace/ui/components/honeycomb'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@workspace/ui/components/tooltip'
import { cn } from '@workspace/ui/lib/utils'
import { activityFor, activityLevel, type DayActivity } from './data'
import { ApprovalMarker, MeetingMarker, TaskMarker } from './markers'
import { MonthPicker } from './month-picker'

// 38 cells flow left-to-right (8 per row, last row short); the first few and last few are the
// neighbouring months' days, drawn in the "no movement" fill. Cells are subtly wider than tall.
const CELLS = 38
const COLS = 8
const LEAD = 3
const CELL_ASPECT = 25.5 / 25

// Fill per activity level (light activity / healthy / at or above target); tokens in globals.css.
const LEVEL_FILL = ['text-heat-1', 'text-heat-2', 'text-heat-3'] as const

function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return s[(v - 20) % 10] ?? s[v] ?? s[0]
}

function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** The hover card for one day: date, counts, and a jump to that day in Task. */
function DayCard({ date, activity, isToday }: { date: Date; activity: DayActivity; isToday: boolean }) {
  const weekday = isToday ? 'Today' : date.toLocaleDateString('en-GB', { weekday: 'long' })
  const day = date.getDate()
  const rest = date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
  const rows = [
    { label: `${activity.meetings} Meeting${activity.meetings === 1 ? '' : 's'}`, icon: <MeetingMarker size={18} /> },
    { label: `${activity.tasks} Task(s) due`, icon: <TaskMarker size={18} /> },
    { label: `${activity.approvals} Approval(s) pending`, icon: <ApprovalMarker size={18} /> },
  ]
  return (
    <div className="w-60 space-y-3.5 p-1">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[15px] text-faint">{weekday},</div>
          <div className="text-[17px] leading-[1.35] text-foreground">
            {day}
            <sup className="text-[10px]">{ordinal(day)}</sup> {rest}
          </div>
        </div>
        <ArrowButton
          small
          aria-label={`Open ${weekday} ${day} in Task`}
          render={<Link to="/$app/$section" params={{ app: 'tasks', section: 'my-tasks' }} search={{ date: isoDate(date) }} />}
        />
      </div>
      <ul className="space-y-2 text-[15px]">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center gap-2.5">
            {r.icon}
            <span className="text-foreground">{r.label}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Month heat map drawn as a honeycomb: one hexagon per day, tinted by activity, today outlined. */
export function MonthHoneycomb({ today }: { today: Date }) {
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate()
  const monthName = cursor.toLocaleDateString('en-GB', { month: 'long' })

  function shift(delta: number) {
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-1">
          <MonthPicker value={cursor} onChange={setCursor} today={today} />
          <Button variant="ghost" size="icon-sm" className="size-7 text-faint" aria-label="Previous month" onClick={() => shift(-1)}>
            <ChevronLeft className="size-[18px]" strokeWidth={1.75} />
          </Button>
          <Button variant="ghost" size="icon-sm" className="size-7 text-faint" aria-label="Next month" onClick={() => shift(1)}>
            <ChevronRight className="size-[18px]" strokeWidth={1.75} />
          </Button>
        </div>
        <ArrowButton aria-label="Open calendar" />
      </div>

      <TooltipProvider delay={150}>
        <Honeycomb
          cellSize="1.375rem"
          aspect={CELL_ASPECT}
          cols={COLS}
          rows={Math.ceil(CELLS / COLS)}
          gap={0.18}
          rowPitch={1}
          role="grid"
          aria-label={`${monthName} activity`}
        >
          {Array.from({ length: CELLS }, (_, i) => {
            const offset = i - LEAD // days since the 1st of the month
            const date = new Date(cursor.getFullYear(), cursor.getMonth(), 1 + offset)
            const inMonth = offset >= 0 && offset < daysInMonth
            const isToday = inMonth && isoDate(date) === isoDate(today)
            const activity = activityFor(date.getFullYear(), date.getMonth(), date.getDate())
            const level = activityLevel(activity)
            const cell = { col: i % COLS, row: Math.floor(i / COLS) }

            // cells rise in one after another, left to right; today arrives last and pulses once
            const stagger = { animationDelay: `${120 + i * 12}ms` }
            const todayEntrance = {
              animation: 'var(--animate-rise), var(--animate-pulse-once)',
              animationDelay: '720ms, 1150ms',
              '--pulse-color': 'var(--heat-today-from)',
            } as CSSProperties
            if (!inMonth) {
              // a real date from the neighbouring month: say which, and jump there on click
              const direction = offset < 0 ? 'previous' : 'next'
              const label = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })
              return (
                <HoneycombItem key={i} {...cell} role="gridcell" className="animate-rise" style={stagger}>
                  <Tooltip>
                    <TooltipTrigger
                      className="block size-full rounded-full outline-none"
                      aria-label={`${label}, ${direction} month`}
                      onClick={() => shift(offset < 0 ? -1 : 1)}
                    >
                      <Hexagon
                        size="100%"
                        aspect={CELL_ASPECT}
                        interactive
                        className="text-heat-0 hover:-translate-y-px hover:text-heat-1"
                      />
                    </TooltipTrigger>
                    <TooltipContent side="bottom" sideOffset={6}>
                      {label} · {direction} month
                    </TooltipContent>
                  </Tooltip>
                </HoneycombItem>
              )
            }
            return (
              <HoneycombItem
                key={i}
                {...cell}
                role="gridcell"
                className={cn(isToday ? 'z-10' : 'animate-rise')}
                style={isToday ? todayEntrance : stagger}
              >
                <Tooltip>
                  <TooltipTrigger
                    className="group block size-full rounded-full outline-none"
                    aria-label={date.toLocaleDateString('en-GB', { dateStyle: 'full' })}
                  >
                    <Hexagon
                      size="100%"
                      aspect={CELL_ASPECT}
                      interactive
                      gradient={isToday ? ['var(--heat-today-from)', 'var(--heat-today-to)'] : undefined}
                      stroke={isToday ? 'var(--heat-today-stroke)' : undefined}
                      // today already wears the gradient and outline, so it only grows a touch on hover
                      hoverGradient={isToday ? undefined : ['var(--heat-hover-from)', 'var(--heat-hover-to)']}
                      hoverStroke={isToday ? undefined : 'var(--heat-today-stroke)'}
                      className={cn(
                        isToday ? 'hover:translate-y-0 hover:scale-[1.08]' : 'hover:-translate-y-px',
                        !isToday && LEVEL_FILL[level]
                      )}
                    />
                  </TooltipTrigger>
                  <TooltipContent side="right" align="start" sideOffset={8} variant="card" showArrow={false}>
                    <DayCard date={date} activity={activity} isToday={isToday} />
                  </TooltipContent>
                </Tooltip>
              </HoneycombItem>
            )
          })}
        </Honeycomb>
      </TooltipProvider>
    </div>
  )
}
