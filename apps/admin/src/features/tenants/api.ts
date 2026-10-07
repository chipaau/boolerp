// The tenants feature's API calls, all of them, in one place (C184): keys and queryOptions
// builders for the route loaders and screens. Components never call the API directly.
import { keepPreviousData, queryOptions } from '@tanstack/react-query'
import { api, createKeys } from '@workspace/api'
import { tenantPageSchema } from './schemas'
import type { TenantListSearch } from './schemas'

export const tenantKeys = createKeys('admin', 'tenants')

export const tenantQueries = {
  /** One page of tenants for the operator's staff (GET /api/v1/tenants, C179), as the URL asks. */
  list: (search: TenantListSearch) =>
    queryOptions({
      queryKey: tenantKeys.list(search),
      queryFn: ({ signal }) => api.get('/api/v1/tenants', { query: search, signal, schema: tenantPageSchema }),
      placeholderData: keepPreviousData,
    }),
}
