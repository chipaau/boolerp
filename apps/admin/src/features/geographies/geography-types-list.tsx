import { useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { DataTable } from '@workspace/ui/components/data-table'
import type { DataTableColumn } from '@workspace/ui/components/data-table'
import { ListToolbar } from '@workspace/ui/components/list-toolbar'
import { cn } from '@workspace/ui/lib/utils'
import { referenceQueries } from '@workspace/reference/api'
import { countryOptions } from '@workspace/reference/options'
import type { GeographyType } from '@workspace/reference/schemas'
import { geographyTypeQueries } from './api'
import { GeographiesHeader } from './geographies-page'
import type { GeographyTypeListSearch } from './schemas'

const route = getRouteApi('/_admin/geographies/geography-types')

/**
 * The geography types tab, /geographies/geography-types (C174, C218, C220): every country's address
 * levels from the API, searched, filtered by country, sorted, and paged on the server, with the state
 * in the URL. Each says how many places of it are listed: a level with none is typed in an address
 * (C217). Read-only, like the countries, until the operator's write rule for reference data exists.
 */
export function GeographyTypesPage() {
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const list = useQuery(geographyTypeQueries.list(search))
  const countries = useQuery(referenceQueries.countries())
  const countryName = useMemo(() => new Map((countries.data ?? []).map((c) => [c.code, c.name])), [countries.data])

  /** Changes the URL; anything but paging goes back to page 1 (C174). */
  const set = useCallback(
    (patch: Partial<GeographyTypeListSearch>) =>
      void navigate({ search: (prev) => ({ ...prev, ...patch, page: 'page' in patch ? (patch.page ?? 1) : 1 }), replace: true }),
    [navigate]
  )
  const clear = () => set({ q: undefined, country: undefined })
  const columns = useMemo(() => geographyTypeColumns((code) => countryName.get(code) ?? code), [countryName])
  const items = list.data?.items
  const total = list.data?.total ?? 0

  return (
    <div className="min-h-0 w-full overflow-y-auto">
      <div className="px-4 pt-7 pb-24 sm:px-8">
        <GeographiesHeader
          tab="geography-types"
          meta={list.data ? `${total} ${total === 1 ? 'address level' : 'address levels'}${search.q || search.country ? ' match' : ''}` : ' '}
        />
        <ListToolbar
          className="mb-3.5 rounded-lg border-0 bg-card px-3.5 py-3"
          search={{ value: search.q, onChange: (q) => set({ q }), placeholder: 'Filter by name or code' }}
          filters={[
            {
              key: 'country',
              label: 'Country',
              type: 'combobox',
              placeholder: 'All countries',
              value: search.country,
              onChange: (country) => set({ country }),
              options: countryOptions(countries.data ?? []),
            },
          ]}
          onClear={clear}
          summary={list.data ? `${items?.length ?? 0} of ${total}` : undefined}
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
          getRowId={(t) => t.id}
          isLoading={list.isPending}
          isFetching={list.isFetching}
          error={list.error}
          onRetry={() => void list.refetch()}
          filtered={Boolean(search.q || search.country)}
          onClearFilters={clear}
          empty={{ title: 'No address levels', description: 'The address levels are loaded when the platform is deployed.' }}
          noun="address levels"
        />
      </div>
    </div>
  )
}

/**
 * The geography types table's columns: the level leads, with its country beside it (a sortable column's
 * id is the API's sort field). On a phone the country, level, and places fold under the level's name.
 */
function geographyTypeColumns(countryName: (code: string) => string): DataTableColumn<GeographyType>[] {
  const places = (t: GeographyType) => (t.placeCount ? `${t.placeCount.toLocaleString('en-GB')} places` : 'typed')
  return [
    {
      id: 'name',
      accessorKey: 'name',
      header: 'Address level',
      enableSorting: true,
      cell: ({ row: { original: t } }) => (
        <div className="min-w-0">
          <div className="block truncate text-sm font-bold text-foreground">{t.name}</div>
          <div className="mt-[3px] hidden font-mono text-xs text-faint md:block">{t.code}</div>
          <div className="mt-[3px] text-xs text-faint md:hidden">
            {countryName(t.country)} · Level {t.level} · {places(t)}
          </div>
        </div>
      ),
      meta: { className: 'min-w-[180px]' },
    },
    {
      id: 'country',
      accessorKey: 'country',
      header: 'Country',
      enableSorting: true,
      cell: ({ row: { original: t } }) => <span className="truncate text-compact text-body">{countryName(t.country)}</span>,
      meta: { wide: true },
    },
    {
      id: 'level',
      accessorKey: 'level',
      header: 'Level',
      enableSorting: true,
      cell: ({ row: { original: t } }) => <span className="text-compact text-body tabular-nums">{t.level}</span>,
      meta: { wide: true },
    },
    {
      id: 'places',
      header: 'Places',
      enableSorting: false,
      cell: ({ row: { original: t } }) => (
        <span className={cn('text-compact tabular-nums', t.placeCount ? 'text-body' : 'text-muted-foreground')}>
          {t.placeCount ? t.placeCount.toLocaleString('en-GB') : 'Typed'}
        </span>
      ),
      meta: { wide: true },
    },
  ]
}
