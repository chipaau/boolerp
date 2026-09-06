import { NativeSelect } from "@workspace/ui/components/native-select"
import { cn } from "@workspace/ui/lib/utils"

const STEPS = [10, 20, 50, 100] as const

/**
 * A table footer's count with the number of rows as a dropdown in the sentence itself:
 * "Showing [10 ▾] of 213 items". The choices are the steps that still cut the list, then All.
 */
function RowsShown({
  shown,
  total,
  limit,
  onLimit,
  noun = "rows",
  className,
}: {
  shown: number
  total: number
  /** Rows the caller currently allows; `Infinity` means all. */
  limit: number
  onLimit: (limit: number) => void
  noun?: string
  className?: string
}) {
  const steps = STEPS.filter((_, i) => i === 0 || STEPS[i - 1] < total)
  const value = Number.isFinite(limit) ? String(limit) : "all"
  return (
    <span data-slot="rows-shown" className={cn("inline-flex items-center gap-2 tabular-nums", className)}>
      Showing
      {total > STEPS[0] ? (
        <NativeSelect
          aria-label="Rows to show"
          value={value}
          onChange={(e) => onLimit(e.target.value === "all" ? Infinity : Number(e.target.value))}
          className="w-[76px] [&>select]:h-[26px] [&>select]:rounded-[7px] [&>select]:pl-2.5 [&>select]:text-caption [&>svg]:right-2 [&>svg]:size-3"
        >
          {steps.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
          <option value="all">All</option>
        </NativeSelect>
      ) : (
        <span>{Math.min(shown, total)}</span>
      )}
      of {total} {noun}
    </span>
  )
}

export { RowsShown }
