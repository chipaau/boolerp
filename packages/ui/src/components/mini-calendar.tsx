import { ChevronLeft, ChevronRight } from "lucide-react"

import { cn } from "@workspace/ui/lib/utils"

/**
 * A month at a glance: 7 columns, six rows, round day buttons. Today wears the sand ring, the
 * selected day the amber fill, days with `marks` a small dot. Dates are local ISO strings
 * (YYYY-MM-DD) so the caller never hands over Date objects across the boundary.
 */
type Props = {
  /** Any day inside the month to show. */
  month: string
  selected?: string
  today?: string
  /** Count per ISO date; any positive count draws the dot. */
  marks?: Record<string, number>
  onSelect?: (iso: string) => void
  /** When given, a header with the month name and previous / next arrows is shown. */
  onMonthChange?: (delta: 1 | -1) => void
  className?: string
  /** Tighter cells for popovers. */
  compact?: boolean
}

const DOW = ["S", "M", "T", "W", "T", "F", "S"]

function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}
function parse(s: string) {
  const [y, m, d] = s.split("-").map(Number)
  return new Date(y, m - 1, d)
}

function MiniCalendar({ month, selected, today, marks = {}, onSelect, onMonthChange, className, compact = false }: Props) {
  const base = parse(month)
  const y = base.getFullYear(), m = base.getMonth()
  const lead = new Date(y, m, 1).getDay()
  const title = base.toLocaleDateString("en-GB", { month: compact ? "long" : "short", year: "numeric" })
  const cells = Array.from({ length: 42 }, (_, i) => new Date(y, m, 1 - lead + i))
  const size = compact ? "size-7 text-xs" : "size-[26px] text-fine"
  return (
    <div data-slot="mini-calendar" className={className}>
      {onMonthChange && (
        <div className="mb-2 flex items-center justify-between gap-1.5">
          <span className="text-ui-sm font-bold tracking-[-0.01em] text-foreground">{title}</span>
          <span className="flex items-center">
            <button type="button" aria-label="Previous month" onClick={() => onMonthChange(-1)} className="grid size-6 place-items-center rounded-full text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
              <ChevronLeft className="size-3" strokeWidth={1.7} />
            </button>
            <button type="button" aria-label="Next month" onClick={() => onMonthChange(1)} className="grid size-6 place-items-center rounded-full text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
              <ChevronRight className="size-3" strokeWidth={1.7} />
            </button>
          </span>
        </div>
      )}
      <div className="grid grid-cols-7">
        {DOW.map((d, i) => (
          <div key={i} className="pb-1 text-center text-[10px] font-bold tracking-[0.06em] text-faint">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((d) => {
          const k = iso(d)
          const inMonth = d.getMonth() === m
          const isToday = k === today
          const on = k === selected
          const n = marks[k] ?? 0
          return (
            <button
              key={k}
              type="button"
              onClick={() => onSelect?.(k)}
              title={n ? `${n} ${n === 1 ? "meeting" : "meetings"}` : undefined}
              aria-pressed={on}
              className={cn(
                "relative justify-self-center rounded-full tabular-nums outline-none transition-colors duration-instant ease-hexa focus-visible:ring-2 focus-visible:ring-ring",
                size,
                on ? "bg-brand-soft font-bold text-brand-cta-foreground" : isToday ? "bg-primary font-bold text-foreground" : "hover:bg-accent",
                !on && !isToday && (inMonth ? "text-body" : "text-faint"),
                !inMonth && "opacity-50"
              )}
            >
              {d.getDate()}
              {n > 0 && !on && <span aria-hidden="true" className="absolute bottom-[3px] left-1/2 size-[2.5px] -translate-x-1/2 rounded-full bg-faint" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export { MiniCalendar }
