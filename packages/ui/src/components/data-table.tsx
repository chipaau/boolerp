import * as React from "react"
import { type ColumnDef, type SortingState, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table"
import { ChevronRight, Lock, RefreshCw } from "lucide-react"

import { cn } from "@workspace/ui/lib/utils"
import { Button } from "@workspace/ui/components/button"
import { EmptyState } from "@workspace/ui/components/empty-state"
import { RowsShown } from "@workspace/ui/components/rows-shown"
import { Skeleton } from "@workspace/ui/components/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TablePagination,
  TableRow,
} from "@workspace/ui/components/table"

/** Per-column display options, on a column definition's `meta`. */
export type DataTableColumnMeta = {
  align?: "left" | "center" | "right"
  /** Hidden below the `lg` breakpoint. */
  wide?: boolean
  className?: string
}

/**
 * A column: a TanStack Table column definition. A sortable one sets `enableSorting`, an `id` that
 * is the API's sort field, and an accessor (`accessorKey` or `accessorFn`): TanStack Table sorts
 * only columns with one, even in manual mode.
 */
export type DataTableColumn<T> = ColumnDef<T, unknown> & { meta?: DataTableColumnMeta }

/** A failed first load as the table shows it (an ApiError fits). */
export type DataTableError = { message: string; forbidden?: boolean; requestId?: string }

/** Reads the API's sort parameter (`-name,code`) into TanStack Table's sorting state. */
export function parseSort(sort?: string): SortingState {
  if (!sort) return []
  return sort.split(",").map((p) => (p.startsWith("-") ? { id: p.slice(1), desc: true } : { id: p, desc: false }))
}

/** Writes TanStack Table's sorting state as the API's sort parameter; none is `undefined` (the list's default). */
export function formatSort(sorting: SortingState): string | undefined {
  return sorting.length ? sorting.map((s) => (s.desc ? `-${s.id}` : s.id)).join(",") : undefined
}

/** The most rows the API returns per page (C68). */
const MAX_PAGE_SIZE = 100

/**
 * The shared list table (C174): TanStack Table renders the columns; pagination, sorting, and
 * filtering happen on the API (manual mode), driven by the caller's URL state. It shows a skeleton
 * on the first load, an empty state that tells "nothing yet" from "nothing matches", a 403 as a
 * forbidden state, other errors with the request reference and a retry (C185: a first load's
 * error is the screen's), and a quiet indicator while refetching.
 */
export function DataTable<T>({
  columns,
  data,
  total,
  page,
  pageSize,
  sort,
  onSortChange,
  onPageChange,
  onPageSizeChange,
  getRowId,
  onRowClick,
  isLoading,
  isFetching,
  error,
  onRetry,
  filtered,
  onClearFilters,
  empty,
  noun = "rows",
  toolbar,
  className,
}: {
  columns: DataTableColumn<T>[]
  /** The page's rows; undefined until the first load. */
  data: T[] | undefined
  total: number
  page: number
  pageSize: number
  sort?: string
  onSortChange: (sort: string | undefined) => void
  onPageChange: (page: number) => void
  onPageSizeChange?: (pageSize: number) => void
  getRowId: (row: T) => string
  onRowClick?: (row: T) => void
  isLoading?: boolean
  isFetching?: boolean
  /** A failed first load; when data is already shown, the error policy toasts instead (C185). */
  error?: DataTableError | null
  onRetry?: () => void
  /** Whether a search or filter is on: an empty page then means "no match", not "none yet". */
  filtered?: boolean
  onClearFilters?: () => void
  empty: { title: string; description?: React.ReactNode; action?: React.ReactNode }
  noun?: string
  toolbar?: React.ReactNode
  className?: string
}) {
  const sorting = React.useMemo(() => parseSort(sort), [sort])
  const table = useReactTable({
    data: data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId,
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    enableMultiSort: false,
    state: { sorting },
    onSortingChange: (updater) => onSortChange(formatSort(typeof updater === "function" ? updater(sorting) : updater)),
  })
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const colSpan = columns.length + (onRowClick ? 1 : 0)
  const shown = (meta?: DataTableColumnMeta) => cn(meta?.wide && "max-lg:hidden", meta?.className)
  const showError = error && !data

  let body: React.ReactNode
  if (showError) {
    body = (
      <FullRow colSpan={colSpan}>
        {error.forbidden ? (
          <EmptyState
            title="You don't have access to this"
            description="Ask an administrator for the permission this list needs."
            action={<Lock aria-hidden="true" className="size-4 text-faint" />}
          />
        ) : (
          <EmptyState
            title="This list couldn't be loaded"
            description={
              <>
                {error.message}
                {error.requestId && <span className="mt-1 block font-mono text-xs text-faint">Reference: {error.requestId}</span>}
              </>
            }
            action={
              onRetry && (
                <Button variant="outline" size="sm" onClick={onRetry}>
                  <RefreshCw /> Try again
                </Button>
              )
            }
          />
        )}
      </FullRow>
    )
  } else if (!data) {
    body = isLoading
      ? Array.from({ length: Math.min(pageSize, 8) }, (_, i) => (
          <TableRow key={i} className="hover:bg-transparent" data-testid="data-table-skeleton">
            {table.getVisibleLeafColumns().map((c) => (
              <TableCell key={c.id} className={shown(c.columnDef.meta as DataTableColumnMeta | undefined)}>
                <Skeleton className="h-4 w-3/4" />
              </TableCell>
            ))}
            {onRowClick && <TableCell />}
          </TableRow>
        ))
      : null
  } else if (table.getRowModel().rows.length === 0) {
    body = (
      <FullRow colSpan={colSpan}>
        {filtered ? (
          <EmptyState
            title={`No ${noun} match these filters`}
            action={
              onClearFilters && (
                <Button variant="link" size="xs" className="font-bold no-underline hover:underline" onClick={onClearFilters}>
                  Clear filters
                </Button>
              )
            }
          />
        ) : (
          <EmptyState title={empty.title} description={empty.description} action={empty.action} />
        )}
      </FullRow>
    )
  } else {
    body = table.getRowModel().rows.map((row) => (
      <TableRow
        key={row.id}
        className={cn(onRowClick && "group cursor-pointer")}
        onClick={onRowClick ? () => onRowClick(row.original) : undefined}
      >
        {row.getVisibleCells().map((cell) => {
          const meta = cell.column.columnDef.meta as DataTableColumnMeta | undefined
          return (
            <TableCell key={cell.id} align={meta?.align} className={shown(meta)}>
              {flexRender(cell.column.columnDef.cell, cell.getContext())}
            </TableCell>
          )
        })}
        {onRowClick && (
          <TableCell className="w-8">
            <ChevronRight
              aria-hidden="true"
              className="ml-auto size-3.5 text-faint transition-transform duration-instant group-hover:translate-x-[3px]"
            />
          </TableCell>
        )}
      </TableRow>
    ))
  }

  return (
    <div data-slot="data-table" aria-busy={isFetching || undefined} className={cn("overflow-clip rounded-xl bg-card", className)}>
      {toolbar}
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((group) => (
            <TableRow key={group.id} className="h-auto hover:bg-transparent">
              {group.headers.map((header) => {
                const meta = header.column.columnDef.meta as DataTableColumnMeta | undefined
                const sortable = header.column.getCanSort()
                return (
                  <TableHead
                    key={header.id}
                    align={meta?.align}
                    className={shown(meta)}
                    sortable={sortable}
                    sorted={header.column.getIsSorted()}
                    tabIndex={sortable ? 0 : undefined}
                    onClick={sortable ? header.column.getToggleSortingHandler() : undefined}
                    onKeyDown={
                      sortable
                        ? (e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault()
                              header.column.toggleSorting()
                            }
                          }
                        : undefined
                    }
                  >
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                )
              })}
              {onRowClick && (
                <TableHead className="w-8">
                  <span className="sr-only">Open</span>
                </TableHead>
              )}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>{body}</TableBody>
      </Table>
      {data && total > 0 && (
        <TableFooter>
          <span className="inline-flex items-center gap-3">
            {onPageSizeChange ? (
              <RowsShown
                shown={Math.min(pageSize, total)}
                total={total}
                limit={pageSize}
                // RowsShown offers All; the API serves at most MAX_PAGE_SIZE rows a page (C68).
                onLimit={(n) => onPageSizeChange(Number.isFinite(n) ? n : MAX_PAGE_SIZE)}
                noun={noun}
              />
            ) : (
              <span className="tabular-nums">
                {total} {noun}
              </span>
            )}
            {isFetching && !isLoading && <RefreshCw aria-label="Refreshing" className="size-3.5 animate-spin text-faint" />}
          </span>
          {pageCount > 1 && <TablePagination page={Math.min(page, pageCount)} pageCount={pageCount} onPageChange={onPageChange} />}
        </TableFooter>
      )}
    </div>
  )
}

function FullRow({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={colSpan} className="py-0">
        {children}
      </TableCell>
    </TableRow>
  )
}
