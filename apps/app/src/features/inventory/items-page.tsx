import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { MoreHorizontal, Plus } from 'lucide-react'
import { Badge } from '@workspace/ui/components/badge'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@workspace/ui/components/breadcrumb'
import { Button, ButtonArrow } from '@workspace/ui/components/button'
import { Card } from '@workspace/ui/components/card'
import { Checkbox } from '@workspace/ui/components/checkbox'
import { EmptyState } from '@workspace/ui/components/empty-state'
import { RowsShown } from '@workspace/ui/components/rows-shown'
import { SearchField } from '@workspace/ui/components/search-field'
import {
  Table,
  TableBody,
  TableBulkAction,
  TableBulkBar,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
  TableToolbar,
} from '@workspace/ui/components/table'
import { PageTitle } from '@/components/layout/page'
import { FILTERS, STATUS_TONE, filterItems, summarize } from './logic'
import { useItems } from './queries'
import type { ItemFilter } from './types'

type Sort = 'name' | 'name-desc' | 'qty' | 'qty-desc' | null

/** All items: the design's table with search, filter chips, sortable columns, selection and the bulk bar. */
export function InventoryItemsPage() {
  const search = useSearch({ from: '/_app/$app/$section' })
  const navigate = useNavigate()
  const filter: ItemFilter = FILTERS.includes(search.filter as ItemFilter) ? (search.filter as ItemFilter) : 'All'
  const [query, setQuery] = useState(search.q ?? '')
  const [sort, setSort] = useState<Sort>(null)
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const items = useItems()
  const s = summarize(items)

  const rows = useMemo(() => {
    const r = filterItems(items, filter, query)
    if (sort === 'name') return [...r].sort((a, b) => a.name.localeCompare(b.name))
    if (sort === 'name-desc') return [...r].sort((a, b) => b.name.localeCompare(a.name))
    if (sort === 'qty') return [...r].sort((a, b) => a.onHand - b.onHand)
    if (sort === 'qty-desc') return [...r].sort((a, b) => b.onHand - a.onHand)
    return r
  }, [items, filter, query, sort])

  const [limit, setLimit] = useState(10)
  // a new filter, search or sort starts again from the first ten
  useEffect(() => setLimit(10), [filter, query, sort])
  const pageRows = rows.slice(0, limit)

  const count = Object.values(selected).filter(Boolean).length
  const allSelected = pageRows.length > 0 && pageRows.every((r) => selected[r.sku])

  function setFilter(next: ItemFilter) {
    setSelected({})
    navigate({
      to: '/$app/$section',
      params: { app: 'inventory', section: 'items' },
      search: { filter: next === 'All' ? undefined : next, q: query || undefined },
      replace: true,
    })
  }

  return (
    <div className="px-12 pt-10 pb-28">
      <Breadcrumb className="mb-4">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link to="/$app" params={{ app: 'inventory' }} />}>Inventory</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>All items</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageTitle
        className="mb-6"
        title="All items"
        meta={
          <span>
            {s.itemCount} items across {s.locations.length} locations
          </span>
        }
        actions={
          <Button>
            Add item
            <ButtonArrow>
              <Plus strokeWidth={2.2} />
            </ButtonArrow>
          </Button>
        }
      />

      <Card className="gap-0 overflow-hidden py-0">
        <TableToolbar className="px-5">
          <SearchField
            size="sm"
            placeholder="Filter items, SKUs, owners…"
            shortcut="/"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelected({})
            }}
            className="min-w-[220px] max-w-xs"
          />
          {FILTERS.map((f) => (
            <Badge key={f} variant={f === filter ? 'filter-active' : 'filter'} render={<button type="button" onClick={() => setFilter(f)} />}>
              {f}
            </Badge>
          ))}
          <span className="flex-1" />
          <Badge variant="filter" render={<button type="button" />}>
            Scan
          </Badge>
          <Badge variant="filter" render={<button type="button" />}>
            Import
          </Badge>
        </TableToolbar>

        {rows.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow className="h-auto hover:bg-transparent">
                <TableHead className="w-10">
                  <Checkbox
                    aria-label="Select all"
                    checked={allSelected}
                    indeterminate={count > 0 && !allSelected}
                    onCheckedChange={(v) => setSelected(v ? Object.fromEntries(pageRows.map((r) => [r.sku, true])) : {})}
                  />
                </TableHead>
                <TableHead sortable sorted={sort === 'name' ? 'asc' : sort === 'name-desc' ? 'desc' : false} onClick={() => setSort(sort === 'name' ? 'name-desc' : 'name')}>
                  Item
                </TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Location</TableHead>
                <TableHead align="center" sortable sorted={sort === 'qty' ? 'asc' : sort === 'qty-desc' ? 'desc' : false} onClick={() => setSort(sort === 'qty' ? 'qty-desc' : 'qty')}>
                  On hand
                </TableHead>
                <TableHead align="center">Issued out</TableHead>
                <TableHead align="center">Status</TableHead>
                <TableHead align="right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.map((r) => (
                <TableRow key={r.sku} selected={!!selected[r.sku]}>
                  <TableCell>
                    <Checkbox
                      aria-label={`Select ${r.name}`}
                      checked={!!selected[r.sku]}
                      onCheckedChange={(v) => setSelected((prev) => ({ ...prev, [r.sku]: !!v }))}
                    />
                  </TableCell>
                  <TableCell className="max-w-[320px] truncate font-bold text-foreground">
                    <button type="button" className="truncate text-left hover:text-link">
                      {r.name}
                    </button>
                  </TableCell>
                  <TableCell className="font-mono text-compact text-muted-foreground">{r.sku}</TableCell>
                  <TableCell className="text-muted-foreground">{r.location}</TableCell>
                  <TableCell align="center" numeric>
                    {r.onHand}
                  </TableCell>
                  <TableCell align="center" className="text-muted-foreground tabular-nums">
                    {r.issued}
                  </TableCell>
                  <TableCell align="center">
                    <Badge variant={STATUS_TONE[r.status]} size="sm">
                      {r.status}
                    </Badge>
                  </TableCell>
                  <TableCell align="right">
                    <Button variant="ghost" size="icon-sm" className="text-muted-foreground" aria-label="Open item">
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState
            title="No items match that filter"
            description="Try a different search term, or clear what's applied."
            action={
              <Button
                onClick={() => {
                  setQuery('')
                  setFilter('All')
                }}
              >
                Clear filters
                <ButtonArrow />
              </Button>
            }
          />
        )}

        {count > 0 && (
          <TableBulkBar label={`${count} ${count === 1 ? 'item' : 'items'} selected`}>
            <TableBulkAction>Move location</TableBulkAction>
            <TableBulkAction>Count &amp; adjust</TableBulkAction>
            <TableBulkAction className="bg-tone-risk text-card shadow-none hover:bg-tone-risk/90 dark:bg-tone-risk dark:text-surface-inverted-foreground">Delete</TableBulkAction>
            <TableBulkAction className="bg-transparent opacity-75 shadow-none dark:bg-transparent" onClick={() => setSelected({})}>
              Clear
            </TableBulkAction>
          </TableBulkBar>
        )}

        <TableFooter>
          <RowsShown shown={pageRows.length} total={rows.length} limit={limit} onLimit={setLimit} noun="items" />
        </TableFooter>
      </Card>
    </div>
  )
}
