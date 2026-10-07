// The tenants API's shapes and the list's URL state (C174, C176, C183): hand-written zod in the
// API's camelCase. Every response is parsed with these, so a drift from the API is a contract
// error naming the field. (types.ts holds the design prototype's fixture types.)
import { z } from 'zod'
import { id, listOf, listSearch, timestamp } from '@workspace/api'

export const tenantStatuses = ['provisioning', 'active', 'suspended', 'archived'] as const
export type TenantStatus = (typeof tenantStatuses)[number]

/** A tenant as GET /api/v1/tenants returns it (C179): the registry's essentials. */
export const tenantSchema = z.object({
  id,
  slug: z.string(),
  code: z.string(),
  name: z.string(),
  status: z.enum(tenantStatuses),
  country: z.string(),
  parentId: id.nullable(),
  parentName: z.string().nullable(),
  workspaceHost: z.string().nullable(),
  createdAt: timestamp,
})
export type Tenant = z.infer<typeof tenantSchema>

/** A page of tenants (C68). */
export const tenantPageSchema = listOf(tenantSchema)
export type TenantPage = z.infer<typeof tenantPageSchema>

/** The list's sort fields: the API's (C179). */
export const tenantSorts = ['name', 'code', 'createdAt'] as const

/** The tenants list's URL: page, pageSize, q, sort, and the status filter, named as the API names them. */
export const tenantListSearch = listSearch({ sorts: tenantSorts }).extend({
  status: z.enum(tenantStatuses).optional().catch(undefined),
})
export type TenantListSearch = z.infer<typeof tenantListSearch>
