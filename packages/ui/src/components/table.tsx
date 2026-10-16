import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { cn } from "@workspace/ui/lib/utils"

/**
 * One geometry for every table: 22px gutters (16px on a phone), 14px column gap, an ivory header band with
 * 11px uppercase labels, 60px rows, a hairline under every row (including the last), no
 * vertical rules. Alignment follows the data type: text left, counts centre, money right,
 * status pills centre, actions right. Wrap in a borderless Card (`py-0 overflow-hidden`).
 */
function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div data-slot="table-container" className="relative w-full overflow-x-auto">
      <table
        data-slot="table"
        className={cn("w-full caption-bottom border-separate border-spacing-0 text-ui", className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("bg-surface-band [&_th]:border-b [&_th]:border-border", className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return <tbody data-slot="table-body" className={cn(className)} {...props} />
}

function TableRow({
  className,
  selected,
  ...props
}: React.ComponentProps<"tr"> & { selected?: boolean }) {
  return (
    <tr
      data-slot="table-row"
      data-state={selected ? "selected" : undefined}
      className={cn(
        "h-[60px] transition-colors duration-instant ease-bool hover:bg-surface-soft data-[state=selected]:bg-primary/40",
        className
      )}
      {...props}
    />
  )
}

type Align = "left" | "center" | "right"
const alignClass: Record<Align, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
}

function TableHead({
  className,
  align = "left",
  sortable,
  sorted,
  ...props
}: React.ComponentProps<"th"> & {
  align?: Align
  sortable?: boolean
  sorted?: "asc" | "desc" | false
}) {
  return (
    <th
      data-slot="table-head"
      aria-sort={sorted ? (sorted === "asc" ? "ascending" : "descending") : undefined}
      className={cn(
        "h-[38px] px-[7px] text-micro font-bold tracking-[0.09em] whitespace-nowrap text-foreground uppercase first:pl-4 last:pr-4 sm:first:pl-[22px] sm:last:pr-[22px]",
        alignClass[align],
        sortable && "cursor-pointer select-none hover:text-sage",
        className
      )}
      {...props}
    >
      {props.children}
      {sorted && <span className="ml-1 text-faint">{sorted === "asc" ? "↑" : "↓"}</span>}
    </th>
  )
}

function TableCell({
  className,
  align = "left",
  numeric,
  ...props
}: React.ComponentProps<"td"> & { align?: Align; numeric?: boolean }) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "border-b border-divider px-[7px] py-[13px] align-middle text-body first:pl-4 last:pr-4 sm:first:pl-[22px] sm:last:pr-[22px] [&:has([role=checkbox])]:pr-0",
        alignClass[align],
        numeric && "font-bold text-foreground tabular-nums",
        className
      )}
      {...props}
    />
  )
}

/** Toolbar above the header band: search pill + filter chips on the left, hints on the right. */
function TableToolbar({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="table-toolbar"
      className={cn("flex flex-wrap items-center gap-3 border-b border-divider px-4 sm:px-[22px] py-4", className)}
      {...props}
    />
  )
}

/** Footer: the count on the left, one link or the pagination on the right. */
function TableFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="table-footer"
      className={cn(
        "flex flex-wrap items-center justify-between gap-x-3 gap-y-2.5 px-4 sm:px-[22px] py-[14px] text-caption text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

/** Raised when rows are selected: an inverted bar with pill actions. */
function TableBulkBar({
  className,
  label,
  children,
  ...props
}: React.ComponentProps<"div"> & { label: React.ReactNode }) {
  return (
    <div
      data-slot="table-bulk-bar"
      className={cn(
        // light: a soft sage band that stays part of the table; dark: the inverted tile, which reads well there
        "flex animate-rise items-center gap-2.5 bg-sage-soft px-4 sm:px-[22px] py-3 text-sage-soft-foreground dark:bg-surface-inverted dark:text-surface-inverted-foreground",
        className
      )}
      {...props}
    >
      <span className="text-sm font-bold">{label}</span>
      <span className="flex-1" />
      {children}
    </div>
  )
}

/** A pill action inside the bulk bar. */
function TableBulkAction({
  className,
  emphasis = false,
  ...props
}: React.ComponentProps<"button"> & { emphasis?: boolean }) {
  return (
    <button
      type="button"
      data-slot="table-bulk-action"
      className={cn(
        "rounded-full px-3.5 py-1.5 text-ui-sm font-bold text-foreground shadow-[inset_0_0_0_1px_var(--divider)] transition-colors duration-instant ease-bool hover:bg-card dark:text-surface-inverted-foreground dark:shadow-none dark:hover:bg-surface-inverted-foreground/25",
        emphasis ? "bg-card dark:bg-surface-inverted-foreground/25" : "bg-card/60 dark:bg-surface-inverted-foreground/15",
        className
      )}
      {...props}
    />
  )
}

/** 30px square pager: current page on sage, others on ivory. */
/**
 * The pages a pager shows: the first, the last, and `siblings` either side of the current one, with
 * "gap" where pages are left out (a single missing page is shown rather than a gap).
 */
function pageItems(page: number, pageCount: number, siblings = 1): (number | "gap")[] {
  const keep = new Set([1, pageCount])
  for (let p = page - siblings; p <= page + siblings; p++) if (p >= 1 && p <= pageCount) keep.add(p)
  const pages = [...keep].sort((a, b) => a - b)
  const items: (number | "gap")[] = []
  pages.forEach((p, i) => {
    const prev = pages[i - 1]
    if (prev !== undefined && p - prev === 2) items.push(prev + 1)
    else if (prev !== undefined && p - prev > 2) items.push("gap")
    items.push(p)
  })
  return items
}

/**
 * Previous, the pages, and next. On a phone only "3 / 10" sits between the arrows; from `sm` the
 * first, the last, and the pages around the current one show, with "…" for the rest, so a long list
 * never overflows its footer.
 */
function TablePagination({
  page,
  pageCount,
  onPageChange,
  className,
  ...props
}: React.ComponentProps<"nav"> & {
  page: number
  pageCount: number
  onPageChange: (page: number) => void
}) {
  const items = pageItems(page, pageCount)
  const btn =
    "grid size-[30px] place-items-center rounded-[7px] text-compact transition-colors duration-instant ease-bool focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none disabled:text-faint"
  return (
    <nav data-slot="table-pagination" aria-label="Pagination" className={cn("flex items-center gap-[7px]", className)} {...props}>
      <button type="button" className={cn(btn, "bg-muted text-body hover:bg-secondary-hover")} disabled={page <= 1} onClick={() => onPageChange(page - 1)} aria-label="Previous page">
        <ChevronLeft className="size-3.5" />
      </button>
      <span className="px-1 text-compact whitespace-nowrap text-body tabular-nums sm:hidden">
        <span aria-hidden="true">
          {page} / {pageCount}
        </span>
        <span className="sr-only">
          Page {page} of {pageCount}
        </span>
      </span>
      <span className="hidden items-center gap-[7px] sm:flex">
        {items.map((p, i) =>
          p === "gap" ? (
            <span key={`gap-${i}`} aria-hidden="true" className="grid size-[30px] place-items-center text-compact text-faint">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              aria-current={p === page ? "page" : undefined}
              className={cn(btn, p === page ? "bg-sage font-bold text-sage-foreground" : "bg-muted text-body hover:bg-secondary-hover")}
              onClick={() => onPageChange(p)}
            >
              {p}
            </button>
          )
        )}
      </span>
      <button type="button" className={cn(btn, "bg-muted text-body hover:bg-secondary-hover")} disabled={page >= pageCount} onClick={() => onPageChange(page + 1)} aria-label="Next page">
        <ChevronRight className="size-3.5" />
      </button>
    </nav>
  )
}

function TableCaption({ className, ...props }: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-caption text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableToolbar,
  TableFooter,
  TableBulkBar,
  TableBulkAction,
  TablePagination,
  TableCaption,
}
