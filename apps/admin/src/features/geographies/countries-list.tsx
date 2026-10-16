import { useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { DataTable } from '@workspace/ui/components/data-table'
import type { DataTableColumn } from '@workspace/ui/components/data-table'
import { ListToolbar } from '@workspace/ui/components/list-toolbar'
import { cn } from '@workspace/ui/lib/utils'
import type { Country } from '@workspace/reference/schemas'
import { countryQueries } from './api'
import { GeographiesHeader } from './geographies-page'
import type { CountryListSearch } from './schemas'

const route = getRouteApi('/_admin/geographies/countries')

/**
 * The countries tab, /geographies/countries (C174, C218): the current countries from the API, searched,
 * sorted, and paged on the server, with the state in the URL. Read-only: countries are the ISO list,
 * seeded; changing them waits for the operator's write rule for reference data, so the design's status
 * switch and "Add a country" are left out rather than shown as controls that do nothing.
 */
export function CountriesPage() {
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const list = useQuery(countryQueries.list(search))

  /** Changes the URL; anything but paging goes back to page 1 (C174). */
  const set = useCallback(
    (patch: Partial<CountryListSearch>) =>
      void navigate({ search: (prev) => ({ ...prev, ...patch, page: 'page' in patch ? (patch.page ?? 1) : 1 }), replace: true }),
    [navigate]
  )
  const clear = () => set({ q: undefined })
  const columns = useMemo(() => countryColumns(), [])
  const items = list.data?.items
  const total = list.data?.total ?? 0

  return (
    <div className="min-h-0 w-full overflow-y-auto">
      <div className="px-4 sm:px-8 pt-7 pb-24">
        <GeographiesHeader tab="countries" meta={list.data ? `${total} ${total === 1 ? 'country' : 'countries'}${search.q ? ' match' : ''}` : ' '} />
        <ListToolbar
          className="mb-3.5 rounded-lg border-0 bg-card px-3.5 py-3"
          search={{ value: search.q, onChange: (q) => set({ q }), placeholder: 'Filter by name or code' }}
          onClear={clear}
          summary={list.data ? `${items?.length ?? 0} of ${total} countries` : undefined}
        />
        <DataTable
          className="rounded-lg"
          columns={columns}
          data={items}
          total={total}
          page={search.page}
          pageSize={search.pageSize}
          sort={search.sort}
          onSortChange={(sort) => set({ sort })}
          onPageChange={(page) => set({ page })}
          onPageSizeChange={(pageSize) => set({ pageSize })}
          getRowId={(c) => c.code}
          isLoading={list.isPending}
          isFetching={list.isFetching}
          error={list.error}
          onRetry={() => void list.refetch()}
          filtered={Boolean(search.q)}
          onClearFilters={clear}
          empty={{ title: 'No countries', description: 'The ISO country list is loaded when the platform is deployed.' }}
          noun="countries"
        />
      </div>
    </div>
  )
}

/** The countries table's columns; a sortable column's id is the API's sort field. */
function countryColumns(): DataTableColumn<Country>[] {
  return [
    {
      id: 'name',
      accessorKey: 'name',
      header: 'Country',
      enableSorting: true,
      cell: ({ row: { original: c } }) => (
        <div className="min-w-0">
          <div className="block truncate text-sm font-bold text-foreground">{c.name}</div>
          <div className="mt-[3px] text-xs text-faint md:hidden">
            {c.code} · {c.phonePrefix}
          </div>
        </div>
      ),
      meta: { className: 'min-w-[200px]' },
    },
    {
      id: 'code',
      accessorKey: 'code',
      header: 'Code',
      enableSorting: true,
      cell: ({ row: { original: c } }) => (
        <span className="font-mono text-xs text-body">
          {c.code} <span className="text-faint">/ {c.alpha3}</span>
        </span>
      ),
      meta: { wide: true },
    },
    {
      id: 'dialing',
      header: 'Dialing',
      enableSorting: false,
      cell: ({ row: { original: c } }) => <span className="font-mono text-xs text-body">{c.phonePrefix}</span>,
      meta: { wide: true },
    },
    {
      id: 'geographies',
      header: 'Geographies',
      enableSorting: false,
      cell: ({ row: { original: c } }) => (
        <span className={cn('text-compact tabular-nums', c.geographyCount ? 'text-body' : 'text-muted-foreground')}>
          {c.geographyCount ? c.geographyCount.toLocaleString('en-GB') : 'None yet'}
        </span>
      ),
      meta: { wide: true },
    },
  ]
}
