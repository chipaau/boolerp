import { useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { Button } from '@workspace/ui/components/button'
import { DataTable } from '@workspace/ui/components/data-table'
import { ListToolbar } from '@workspace/ui/components/list-toolbar'
import { tenantQueries } from './api'
import { statusLabel, tenantColumns } from './columns'
import { tenantStatuses } from './schemas'
import type { TenantListSearch } from './schemas'

const route = getRouteApi('/_admin/tenants/')

/**
 * The tenants list (C174, C179), in the tenants page's design: every tenant from the API, searched,
 * filtered, sorted, and paged on the server, with its state in the URL. Creating a tenant (F3) and
 * the lifecycle actions show disabled until their endpoints exist. The design prototype this
 * replaces is at /tenants-prototype until this is accepted.
 */
export function TenantsList() {
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const list = useQuery(tenantQueries.list(search))

  /** Changes the URL; anything but paging goes back to page 1 (C174). */
  const set = useCallback(
    (patch: Partial<TenantListSearch>) =>
      void navigate({ search: (prev) => ({ ...prev, ...patch, page: 'page' in patch ? (patch.page ?? 1) : 1 }), replace: true }),
    [navigate]
  )
  const clear = () => set({ q: undefined, status: undefined })

  const items = list.data?.items
  const parents = useMemo(() => new Map((items ?? []).map((t) => [t.id, t.name])), [items])
  const columns = useMemo(() => tenantColumns(parents), [parents])
  const total = list.data?.total ?? 0

  return (
    <div className="min-h-0 w-full overflow-y-auto">
      <div className="px-8 pt-[26px] pb-24">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-5">
          <div className="min-w-0">
            <h1 className="text-[29px] leading-none font-black tracking-[-0.02em] text-foreground">Tenants</h1>
            <p className="mt-[9px] text-sm text-faint">
              {list.data ? `${total} ${total === 1 ? 'tenant' : 'tenants'}${search.q || search.status ? ' match' : ''}` : ' '}
            </p>
          </div>
          <Button disabled title="Not available yet: creating tenants comes next (F3).">
            New tenant
          </Button>
        </div>

        <ListToolbar
          className="mb-3.5 rounded-lg border-0 bg-card px-3.5 py-3"
          search={{ value: search.q, onChange: (q) => set({ q }), placeholder: 'Filter by name, code, or slug' }}
          filters={[
            {
              key: 'status',
              label: 'Status',
              type: 'select',
              value: search.status,
              onChange: (status) => set({ status: status as TenantListSearch['status'] }),
              options: tenantStatuses.map((s) => ({ value: s, label: statusLabel(s) })),
            },
          ]}
          onClear={clear}
          summary={list.data ? `${items?.length ?? 0} of ${total} tenants` : undefined}
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
          filtered={Boolean(search.q || search.status)}
          onClearFilters={clear}
          empty={{ title: 'No tenants yet', description: 'Tenants appear here once they are created.' }}
          noun="tenants"
        />
      </div>
    </div>
  )
}
