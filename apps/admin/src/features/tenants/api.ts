// The tenants feature's API calls, all of them, in one place (C184): keys and queryOptions
// builders for the route loaders and screens. Components never call the API directly.
import { keepPreviousData, queryOptions } from '@tanstack/react-query'
import { api, createKeys } from '@workspace/api'
import { tenantAddressSchema, tenantPageSchema, tenantSchema } from './schemas'
import type { AddressInput, AddressKind, CreateTenantInput, TenantListSearch } from './schemas'

export const tenantKeys = createKeys('admin', 'tenants')
export const tenantAddressKeys = createKeys('admin', 'tenant-addresses')

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
  /**
   * Sets a tenant's address of a kind, the whole of it (PUT /api/v1/tenants/{id}/addresses/{kind},
   * C217). Use with useApiMutation({ form }) so the API's 422 lands on the address's fields (C176).
   */
  setAddress: (tenantId: string, kind: AddressKind) => ({
    mutationFn: (body: AddressInput) =>
      api.put(`/api/v1/tenants/${tenantId}/addresses/${kind}`, { body, schema: tenantAddressSchema }),
    meta: { invalidates: [tenantAddressKeys.lists()] },
  }),
}
