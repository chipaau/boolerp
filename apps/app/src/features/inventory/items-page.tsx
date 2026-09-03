import { useMemo, useState } from 'react'
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

  const count = Object.values(selected).filter(Boolean).length
  const allSelected = rows.length > 0 && rows.every((r) => selected[r.sku])

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

      <div className="mb-6 flex flex-wrap items-end justify-between gap-5">
        <div>
          <h1 className="text-[30px] leading-none font-medium tracking-[-0.022em] text-foreground">All items</h1>
          <div className="mt-2 text-sm text-muted-foreground">
            {s.itemCount} items across {s.locations.length} locations
          </div>
        </div>
        <Button>
          Add item
          <ButtonArrow>
            <Plus strokeWidth={2.2} />
          </ButtonArrow>
        </Button>
      </div>

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
                    onCheckedChange={(v) => setSelected(v ? Object.fromEntries(rows.map((r) => [r.sku, true])) : {})}
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
              {rows.map((r) => (
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
                  <TableCell className="font-mono text-[13px] text-muted-foreground">{r.sku}</TableCell>
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
            <TableBulkAction className="bg-tone-risk hover:bg-tone-risk/90">Delete</TableBulkAction>
            <TableBulkAction className="bg-transparent opacity-75" onClick={() => setSelected({})}>
              Clear
            </TableBulkAction>
          </TableBulkBar>
        )}

        <TableFooter>
          <span>
            Showing {rows.length} of {items.length} items
          </span>
        </TableFooter>
      </Card>
    </div>
  )
}
