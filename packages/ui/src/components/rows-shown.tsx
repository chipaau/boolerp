import { SelectField } from "@workspace/ui/components/select"
import { cn } from "@workspace/ui/lib/utils"

const STEPS = [10, 20, 50, 100] as const

/**
 * A table footer's count with the number of rows as a dropdown in the sentence itself:
 * "Showing [10 ▾] of 213", and on a phone just "[10 ▾] of 213", so it sits on one line with the
 * pager (C219); the page above names what is listed. The choices are the steps that still cut the
 * list, the current page size among them (the API's default is 25, C68), then All. When every row
 * fits on one page there is nothing to choose: just the count ("19 of 19").
 */
function RowsShown({
  shown,
  total,
  limit,
  onLimit,
  className,
}: {
  shown: number
  total: number
  /** Rows the caller currently allows; `Infinity` means all. */
  limit: number
  onLimit: (limit: number) => void
  className?: string
}) {
  const steps = STEPS.filter((_, i) => i === 0 || STEPS[i - 1] < total)
  const choices = Number.isFinite(limit) && !steps.includes(limit as (typeof STEPS)[number]) ? [...steps, limit].sort((a, b) => a - b) : steps
  const value = Number.isFinite(limit) ? String(limit) : "all"
  const oneOrAllPages = Number.isFinite(limit) ? total <= limit : false
  return (
    <span data-slot="rows-shown" className={cn("inline-flex items-center gap-2 whitespace-nowrap tabular-nums", className)}>
      <span className="hidden sm:inline">Showing</span>
      {total > STEPS[0] && !oneOrAllPages ? (
        <SelectField
          aria-label="Rows to show"
          value={value}
          onValueChange={(v) => onLimit(v === "all" ? Infinity : Number(v))}
          className="h-[26px] w-[76px] rounded-[7px] pl-2.5 text-caption"
          options={[...choices.map((s) => String(s)), { value: "all", label: "All" }]}
        />
      ) : (
        <span>{Math.min(shown, total).toLocaleString("en-GB")}</span>
      )}
      <span>of {total.toLocaleString("en-GB")}</span>
    </span>
  )
}

export { RowsShown }
