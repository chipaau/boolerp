import { useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { DataTable } from '@workspace/ui/components/data-table'
import type { DataTableColumn } from '@workspace/ui/components/data-table'
import { ListToolbar } from '@workspace/ui/components/list-toolbar'
import type { ListFilter } from '@workspace/ui/components/list-toolbar'
import { cn } from '@workspace/ui/lib/utils'
import { referenceQueries } from '@workspace/reference/api'
import { countryOptions } from '@workspace/reference/options'
import type { Geography } from '@workspace/reference/schemas'
import { geographyQueries } from './api'
import { GeographiesHeader } from './geographies-page'
import type { GeographyListSearch } from './schemas'

const route = getRouteApi('/_admin/geographies/geographies')

/**
 * The geographies tab, /geographies/geographies (C174, C218, C221): every place addresses pick from,
 * at every level, from the API, searched, filtered by country and, once a country is picked, by its
 * address level, sorted, and paged on the server, with the state in the URL. Read-only, like the
 * countries and the address levels, until the operator's write rule for reference data exists.
 */
export function GeographiesPage() {
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const list = useQuery(geographyQueries.list(search))
  const countries = useQuery(referenceQueries.countries())
  const types = useQuery(referenceQueries.geographyTypes(search.country ?? ''))
  const countryName = useMemo(() => new Map((countries.data ?? []).map((c) => [c.code, c.name])), [countries.data])

  /** Changes the URL; anything but paging goes back to page 1 (C174). */
  const set = useCallback(
    (patch: Partial<GeographyListSearch>) =>
      void navigate({ search: (prev) => ({ ...prev, ...patch, page: 'page' in patch ? (patch.page ?? 1) : 1 }), replace: true }),
    [navigate]
  )
  const clear = () => set({ q: undefined, country: undefined, type: undefined })
  const columns = useMemo(() => geographyColumns((code) => countryName.get(code) ?? code), [countryName])
  const items = list.data?.items
  const total = list.data?.total ?? 0

  const filters: ListFilter[] = [
    {
      key: 'country',
      label: 'Country',
      type: 'combobox',
      placeholder: 'All countries',
      value: search.country,
      // Another country's levels are not this one's: the type filter goes with it.
      onChange: (country) => set({ country, type: undefined }),
      options: countryOptions(countries.data ?? []),
    },
  ]
  if (search.country && types.data?.length) {
    filters.push({
      key: 'type',
      label: 'Address level',
      type: 'select',
      value: search.type,
      onChange: (type) => set({ type }),
      options: types.data.map((t) => ({ value: t.code, label: t.name })),
    })
  }

  return (
    <div className="min-h-0 w-full overflow-y-auto">
      <div className="px-4 pt-7 pb-24 sm:px-8">
        <GeographiesHeader
          tab="geographies"
          meta={list.data ? `${total.toLocaleString('en-GB')} ${total === 1 ? 'place' : 'places'}${search.q || search.country ? ' match' : ''}` : ' '}
        />
        <ListToolbar
          className="mb-3.5 rounded-lg border-0 bg-card px-3.5 py-3"
          search={{ value: search.q, onChange: (q) => set({ q }), placeholder: 'Filter by name, short name, or code' }}
          filters={filters}
          onClear={clear}
          summary={list.data ? `${items?.length ?? 0} of ${total.toLocaleString('en-GB')}` : undefined}
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
          getRowId={(g) => g.id}
          isLoading={list.isPending}
          isFetching={list.isFetching}
          error={list.error}
          onRetry={() => void list.refetch()}
          filtered={Boolean(search.q || search.country || search.type)}
          onClearFilters={clear}
          empty={{ title: 'No places', description: 'The places are loaded when the platform is deployed.' }}
          noun="places"
        />
      </div>
    </div>
  )
}

/**
 * The geographies table's columns: the place leads, with its type, parent, and country beside it (a
 * sortable column's id is the API's sort field). On a phone they fold under the place's name.
 */
function geographyColumns(countryName: (code: string) => string): DataTableColumn<Geography>[] {
  return [
    {
      id: 'name',
      accessorKey: 'name',
      header: 'Place',
      enableSorting: true,
      cell: ({ row: { original: g } }) => (
        <div className="min-w-0">
          <div className="block truncate text-sm font-bold text-foreground">
            {g.shortName && g.shortName !== g.name ? (
              <>
                <span className="text-faint">{g.shortName}</span> {g.name}
              </>
            ) : (
              g.name
            )}
          </div>
          {g.code && <div className="mt-[3px] hidden font-mono text-xs text-faint md:block">{g.code}</div>}
          <div className="mt-[3px] text-xs text-faint md:hidden">
            {[g.typeName, g.parentName, countryName(g.country)].filter(Boolean).join(' · ')}
          </div>
        </div>
      ),
      meta: { className: 'min-w-[200px]' },
    },
    {
      id: 'level',
      accessorKey: 'level',
      header: 'Type',
      enableSorting: true,
      cell: ({ row: { original: g } }) => (
        <span className="text-compact text-body">
          {g.typeName} <span className="text-faint tabular-nums">· {g.level}</span>
        </span>
      ),
      meta: { wide: true },
    },
    {
      id: 'parent',
      header: 'Sits under',
      enableSorting: false,
      cell: ({ row: { original: g } }) => <span className="truncate text-compact text-body">{g.parentName ?? '—'}</span>,
      meta: { wide: true },
    },
    {
      id: 'country',
      accessorKey: 'country',
      header: 'Country',
      enableSorting: true,
      cell: ({ row: { original: g } }) => <span className="truncate text-compact text-body">{countryName(g.country)}</span>,
      meta: { wide: true },
    },
    {
      id: 'children',
      header: 'Places under',
      enableSorting: false,
      cell: ({ row: { original: g } }) => (
        <span className={cn('text-compact tabular-nums', g.childCount ? 'text-body' : 'text-muted-foreground')}>
          {g.childCount ? g.childCount.toLocaleString('en-GB') : '—'}
        </span>
      ),
      meta: { wide: true },
    },
  ]
}
