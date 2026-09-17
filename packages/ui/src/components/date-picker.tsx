"use client"

import * as React from "react"
import { CalendarDays } from "lucide-react"

import { MiniCalendar } from "@workspace/ui/components/mini-calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover"
import { cn } from "@workspace/ui/lib/utils"

function todayIso() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}
function shiftMonth(iso: string, delta: number) {
  const [y, m] = iso.split("-").map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`
}
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
function label(iso: string) {
  const [y, m, d] = iso.split("-").map(Number)
  // built by hand: Intl's en-GB gives "Wed, 30 Sept 2026", the design wants "Wed 30 Sep 2026"
  const date = new Date(y, m - 1, d)
  return `${WEEKDAYS[date.getDay()]} ${d} ${MONTHS[m - 1]} ${y}`
}

/**
 * A date field: an ivory trigger showing "Wed 30 Sep 2026" that opens the MiniCalendar in a
 * popover (the same picker as New meeting). Values are local ISO days (YYYY-MM-DD); `''` = empty.
 */
function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  disabled,
  marks,
  className,
  id,
  "aria-label": ariaLabel,
}: {
  value: string
  onChange: (iso: string) => void
  placeholder?: string
  disabled?: boolean
  /** Count per ISO date; any positive count draws a dot. */
  marks?: Record<string, number>
  className?: string
  id?: string
  "aria-label"?: string
}) {
  const [open, setOpen] = React.useState(false)
  const [month, setMonth] = React.useState(() => (value || todayIso()).slice(0, 8) + "01")
  React.useEffect(() => {
    if (open) setMonth((value || todayIso()).slice(0, 8) + "01")
  }, [open, value])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        id={id}
        disabled={disabled}
        aria-label={ariaLabel}
        data-slot="date-picker"
        className={cn(
          "flex h-10 w-full items-center justify-between gap-2 rounded-[10px] bg-surface-band pr-3 pl-[13px] text-left text-sm tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          value ? "font-bold text-foreground" : "text-placeholder",
          className
        )}
      >
        <span className="truncate">{value ? label(value) : placeholder}</span>
        <CalendarDays className="size-[15px] shrink-0 text-faint" strokeWidth={1.6} />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[252px] p-3">
        <MiniCalendar
          compact
          month={month}
          selected={value || undefined}
          today={todayIso()}
          marks={marks}
          onSelect={(d) => {
            onChange(d)
            setOpen(false)
          }}
          onMonthChange={(d) => setMonth(shiftMonth(month, d))}
        />
      </PopoverContent>
    </Popover>
  )
}

export { DatePicker }
