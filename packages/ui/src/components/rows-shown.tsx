import { SelectField } from "@workspace/ui/components/select"
import { cn } from "@workspace/ui/lib/utils"

/** The page sizes offered, the API's default among them (25, C68). They stay the same whatever is
 * chosen: a choice that removed its own option would leave the select with no value. */
const STEPS = [10, 20, 25, 50, 100] as const

/**
 * A table footer's count with the number of rows as a dropdown in the sentence itself:
 * "Showing [10 ▾] of 213", and on a phone just "[10 ▾] of 213", so it sits on one line with the
 * pager (C219); the page above names what is listed. The choices are the steps that still cut the
 * list, then All. When every row already fits on one page the choice reads All ("Showing [All] of
 * 19", not the page size, which would claim 25 of 19), and still offers the smaller pages.
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
  const value = Number.isFinite(limit) && total > limit ? String(limit) : "all"
  return (
    <span data-slot="rows-shown" className={cn("inline-flex items-center gap-2 whitespace-nowrap tabular-nums", className)}>
      <span className="hidden sm:inline">Showing</span>
      {total > STEPS[0] ? (
        <SelectField
          aria-label="Rows to show"
          value={value}
          // Only a page size or All: a select left without a value must not ask for zero rows.
          onValueChange={(v) => {
            if (v === "all") onLimit(Infinity)
            else if (Number(v) > 0) onLimit(Number(v))
          }}
          className="h-[26px] w-[76px] rounded-[7px] pl-2.5 text-caption"
          options={[...steps.map((s) => String(s)), { value: "all", label: "All" }]}
        />
      ) : (
        <span>{Math.min(shown, total).toLocaleString("en-GB")}</span>
      )}
      <span>of {total.toLocaleString("en-GB")}</span>
    </span>
  )
}

export { RowsShown }
