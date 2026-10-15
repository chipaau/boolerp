// The tenants feature's API calls, all of them, in one place (C184): keys and queryOptions
// builders for the route loaders and screens. Components never call the API directly.
import { keepPreviousData, queryOptions } from '@tanstack/react-query'
import { api, createKeys } from '@workspace/api'
import { tenantPageSchema, tenantSchema } from './schemas'
import type { CreateTenantInput, TenantListSearch } from './schemas'

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

export const tenantMutations = {
  /**
   * Creates a tenant in provisioning (POST /api/v1/tenants, C197); the lists refetch once it is
   * made. Use with useApiMutation({ form }) so the API's 422 lands on the form's fields (C176).
   */
  create: () => ({
    mutationFn: (body: CreateTenantInput) => api.post('/api/v1/tenants', { body, schema: tenantSchema }),
    meta: { invalidates: [tenantKeys.lists()] },
  }),
}
