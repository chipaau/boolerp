import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { cn } from "@workspace/ui/lib/utils"

/**
 * One geometry for every table: 22px gutters, 14px column gap, an ivory header band with
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
        "h-[60px] transition-colors duration-instant ease-hexa hover:bg-surface-soft data-[state=selected]:bg-primary/40",
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
        "h-[38px] px-[7px] text-micro font-bold tracking-[0.09em] whitespace-nowrap text-foreground uppercase first:pl-[22px] last:pr-[22px]",
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
        "border-b border-divider px-[7px] py-[13px] align-middle text-body first:pl-[22px] last:pr-[22px] [&:has([role=checkbox])]:pr-0",
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
      className={cn("flex flex-wrap items-center gap-3 border-b border-divider px-[22px] py-4", className)}
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
        "flex items-center justify-between gap-3 px-[22px] py-[14px] text-caption text-muted-foreground",
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
        "flex animate-rise items-center gap-2.5 bg-surface-inverted px-[22px] py-3 text-surface-inverted-foreground",
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
        "rounded-full px-3.5 py-1.5 text-ui-sm font-bold text-surface-inverted-foreground transition-colors duration-instant ease-hexa hover:bg-surface-inverted-foreground/25",
        emphasis ? "bg-surface-inverted-foreground/25" : "bg-surface-inverted-foreground/15",
        className
      )}
      {...props}
    />
  )
}

/** 30px square pager: current page on sage, others on ivory. */
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
  const pages = Array.from({ length: pageCount }, (_, i) => i + 1)
  const btn =
    "grid size-[30px] place-items-center rounded-[7px] text-compact transition-colors duration-instant ease-hexa focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none disabled:text-faint"
  return (
    <nav data-slot="table-pagination" aria-label="Pagination" className={cn("flex items-center gap-[7px]", className)} {...props}>
      <button type="button" className={cn(btn, "bg-muted text-body hover:bg-secondary-hover")} disabled={page <= 1} onClick={() => onPageChange(page - 1)} aria-label="Previous page">
        <ChevronLeft className="size-3.5" />
      </button>
      {pages.map((p) => (
        <button
          key={p}
          type="button"
          aria-current={p === page ? "page" : undefined}
          className={cn(btn, p === page ? "bg-sage font-bold text-sage-foreground" : "bg-muted text-body hover:bg-secondary-hover")}
          onClick={() => onPageChange(p)}
        >
          {p}
        </button>
      ))}
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
