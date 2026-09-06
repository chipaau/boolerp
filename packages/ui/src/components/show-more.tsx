import { cn } from "@workspace/ui/lib/utils"

/**
 * A table footer's count with the way to see more of the list beside it: "Showing 10 of 30 items
 * · Show 10 more · Show all", and "Show fewer" once everything is on screen. A step at a time
 * keeps the page light; "all" is there for people who want to scan or print.
 */
function ShowMore({
  shown,
  total,
  step = 10,
  onShow,
  noun = "rows",
  className,
}: {
  shown: number
  total: number
  step?: number
  /** Called with the new number of rows to show; `Infinity` for all. */
  onShow: (limit: number) => void
  noun?: string
  className?: string
}) {
  const all = shown >= total
  const link = "font-bold text-link outline-none hover:underline hover:underline-offset-[3px] focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
  return (
    <span data-slot="show-more" className={cn("inline-flex flex-wrap items-center gap-x-2.5 tabular-nums", className)}>
      <span>
        Showing {Math.min(shown, total)} of {total} {noun}
      </span>
      {total > step && (
        <>
          <span aria-hidden="true" className="text-faint">·</span>
          {all ? (
            <button type="button" onClick={() => onShow(step)} className={link}>
              Show fewer
            </button>
          ) : (
            <>
              <button type="button" onClick={() => onShow(shown + step)} className={link}>
                Show {Math.min(step, total - shown)} more
              </button>
              <button type="button" onClick={() => onShow(Infinity)} className={link}>
                Show all
              </button>
            </>
          )}
        </>
      )}
    </span>
  )
}

export { ShowMore }
