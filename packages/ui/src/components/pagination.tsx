import { ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { Segmented, SegmentedItem } from "@workspace/ui/components/segmented"
import { cn } from "@workspace/ui/lib/utils"

export const PAGE_SIZES = [10, 20, 50] as const
export type PageSize = number | "all"

/** The slice of `rows` for a page; `page` is clamped so a shrinking list never shows an empty page. */
export function paginate<T>(rows: T[], page: number, size: PageSize): { rows: T[]; page: number; pages: number } {
  const n = size === "all" ? Math.max(rows.length, 1) : size
  const pages = Math.max(1, Math.ceil(rows.length / n))
  const p = Math.min(Math.max(1, page), pages)
  return { rows: rows.slice((p - 1) * n, p * n), page: p, pages }
}

/**
 * A table footer's paging: "Showing 1–10 of 30 items" on the left; on the right the rows-per-page
 * choice as a segmented control (10 · 20 · 50 · All) and, when there is more than one page, the
 * page position with previous/next.
 */
function Pagination({
  total,
  page,
  pageSize,
  onPage,
  onPageSize,
  noun = "rows",
  sizes = PAGE_SIZES,
  className,
}: {
  total: number
  page: number
  pageSize: PageSize
  onPage: (page: number) => void
  onPageSize: (size: PageSize) => void
  noun?: string
  sizes?: readonly number[]
  className?: string
}) {
  const { page: p, pages } = paginate(Array.from({ length: total }), page, pageSize)
  const n = pageSize === "all" ? total : pageSize
  const from = total === 0 ? 0 : (p - 1) * n + 1
  const to = Math.min(total, p * n)
  return (
    <div data-slot="pagination" className={cn("flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-2", className)}>
      <span className="tabular-nums">{total === 0 ? `No ${noun}` : `Showing ${from}–${to} of ${total} ${noun}`}</span>
      <div className="flex items-center gap-3">
        <span className="text-caption text-faint">Rows</span>
        <Segmented className="h-[30px]">
          {sizes.map((s) => (
            <SegmentedItem key={s} active={pageSize === s} onClick={() => onPageSize(s)} className="h-[26px] px-2.5 text-caption tabular-nums">
              {s}
            </SegmentedItem>
          ))}
          <SegmentedItem active={pageSize === "all"} onClick={() => onPageSize("all")} className="h-[26px] px-2.5 text-caption">
            All
          </SegmentedItem>
        </Segmented>
        {pages > 1 && (
          <span className="flex items-center gap-0.5">
            <Button variant="ghost" size="icon-xs" aria-label="Previous page" disabled={p <= 1} onClick={() => onPage(p - 1)}>
              <ChevronLeft strokeWidth={1.75} />
            </Button>
            <span className="min-w-[52px] text-center text-caption tabular-nums">
              {p} / {pages}
            </span>
            <Button variant="ghost" size="icon-xs" aria-label="Next page" disabled={p >= pages} onClick={() => onPage(p + 1)}>
              <ChevronRight strokeWidth={1.75} />
            </Button>
          </span>
        )}
      </div>
    </div>
  )
}

export { Pagination }
