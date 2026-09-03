import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@workspace/ui/components/button'
import { Popover, PopoverContent, PopoverTrigger } from '@workspace/ui/components/popover'
import { cn } from '@workspace/ui/lib/utils'

const MONTHS = Array.from({ length: 12 }, (_, m) =>
  new Date(2000, m, 1).toLocaleDateString('en-GB', { month: 'short' })
)

/**
 * Month + year picker behind the heat-map month label: a year row with chevrons and a 4 x 3
 * grid of months, the chosen one on sage, today's month outlined. Built on the shared Popover so
 * it follows the theme.
 */
export function MonthPicker({
  value,
  onChange,
  today,
  className,
}: {
  /** First day of the shown month. */
  value: Date
  onChange: (firstOfMonth: Date) => void
  today: Date
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [year, setYear] = useState(value.getFullYear())
  const label = value.toLocaleDateString('en-GB', { month: 'long' })

  function pick(month: number) {
    onChange(new Date(year, month, 1))
    setOpen(false)
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) setYear(value.getFullYear())
      }}
    >
      <PopoverTrigger
        className={cn(
          // a fixed width keeps the chevrons beside it from drifting as the month name changes
          'inline-flex h-8 w-[6.75rem] items-center rounded-md text-left text-base font-bold text-muted-foreground transition-colors duration-instant ease-hexa outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-open:text-foreground',
          className
        )}
        aria-label={`Change month, currently ${label} ${value.getFullYear()}`}
      >
        {label}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64">
        <div className="mb-2 flex items-center justify-between">
          <Button variant="ghost" size="icon-sm" className="size-7 text-faint" aria-label="Previous year" onClick={() => setYear((y) => y - 1)}>
            <ChevronLeft className="size-4" strokeWidth={1.75} />
          </Button>
          <span className="text-sm font-bold text-foreground tabular-nums">{year}</span>
          <Button variant="ghost" size="icon-sm" className="size-7 text-faint" aria-label="Next year" onClick={() => setYear((y) => y + 1)}>
            <ChevronRight className="size-4" strokeWidth={1.75} />
          </Button>
        </div>
        <div className="grid grid-cols-4 gap-1.5" role="listbox" aria-label="Month">
          {MONTHS.map((name, m) => {
            const selected = year === value.getFullYear() && m === value.getMonth()
            const isNow = year === today.getFullYear() && m === today.getMonth()
            return (
              <button
                key={name}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => pick(m)}
                className={cn(
                  'h-9 rounded-md text-[13px] font-bold transition-colors duration-instant ease-hexa outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  selected
                    ? 'bg-sage text-sage-foreground'
                    : 'text-body hover:bg-accent hover:text-foreground',
                  isNow && !selected && 'shadow-[inset_0_0_0_1px_var(--sage)]'
                )}
              >
                {name}
              </button>
            )
          })}
        </div>
        <div className="mt-2.5 flex justify-end">
          <Button
            variant="link"
            size="sm"
            onClick={() => {
              onChange(new Date(today.getFullYear(), today.getMonth(), 1))
              setOpen(false)
            }}
          >
            Today
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
