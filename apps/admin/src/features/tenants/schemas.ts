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

/**
 * POST /api/v1/tenants's body (C197): the request that creates a tenant in provisioning. Optional
 * fields are left out when empty.
 */
export const createTenantSchema = z.object({
  name: z.string(),
  slug: z.string(),
  code: z.string(),
  country: z.string(),
  legalFormId: id,
  timezone: z.string(),
  institutionTypes: z.array(z.object({ code: z.string(), primary: z.boolean() })),
  parentId: id.optional(),
  identityNumber: z.string().optional(),
  registeredOn: z.iso.date().optional(),
  taxNumber: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
})
export type CreateTenantInput = z.infer<typeof createTenantSchema>

const slugPattern = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/
const codePattern = /^[A-Z0-9]{2,10}$/
const phonePattern = /^\+[0-9]{6,15}$/
/** A phone as typed, with the spaces and hyphens people write left out. */
const compactPhone = (s: string) => s.replace(/[\s-]/g, '')

/**
 * The create form's values (C176): the body's fields as the form edits them (empty strings for
 * what is not set), plus what only the form needs: whether the tenant sits under a parent, and
 * the identity document the chosen legal form names, which makes its number required. The rules
 * the browser can check are here; the API checks the rest, and its errors land on these fields.
 */
export const newTenantFormSchema = z
  .object({
    name: z.string().trim().min(1, 'is required').max(200, 'must be at most 200 characters'),
    slug: z.string().regex(slugPattern, 'must be 3 to 63 lowercase letters, digits, and hyphens, not starting or ending with a hyphen'),
    code: z.string().regex(codePattern, 'must be 2 to 10 capital letters and digits'),
    country: z.string().min(1, 'is required'),
    legalFormId: z.string().min(1, 'is required'),
    identityDocument: z.string().nullable(),
    identityNumber: z.string(),
    registeredOn: z.string(),
    taxNumber: z.string(),
    timezone: z.string().min(1, 'is required'),
    institutionTypes: z.array(z.object({ code: z.string(), primary: z.boolean() })).min(1, 'needs at least one type'),
    email: z.union([z.literal(''), z.email('is not an e-mail address')]),
    phone: z.string().refine((s) => s === '' || phonePattern.test(compactPhone(s)), 'must be in international form: + and the country code'),
    tree: z.enum(['Standalone', 'Child']),
    parentId: z.string(),
  })
  .superRefine((v, ctx) => {
    if (v.identityDocument && !v.identityNumber.trim()) ctx.addIssue({ code: 'custom', path: ['identityNumber'], message: 'is required' })
    if (v.tree === 'Child' && !v.parentId) ctx.addIssue({ code: 'custom', path: ['parentId'], message: 'is required' })
    if (v.institutionTypes.length > 0 && v.institutionTypes.filter((t) => t.primary).length !== 1)
      ctx.addIssue({ code: 'custom', path: ['institutionTypes'], message: 'must mark exactly one type as primary' })
  })
export type NewTenantForm = z.infer<typeof newTenantFormSchema>

/** An empty create form. */
export const newTenantForm: NewTenantForm = {
  name: '', slug: '', code: '', country: '', legalFormId: '', identityDocument: null, identityNumber: '',
  registeredOn: '', taxNumber: '', timezone: '', institutionTypes: [], email: '', phone: '', tree: 'Standalone', parentId: '',
}

/** The create form's values as POST /api/v1/tenants's body (C176): what is set, trimmed. */
export function toCreateTenantInput(v: NewTenantForm): CreateTenantInput {
  const optional = (s: string) => (s.trim() ? s.trim() : undefined)
  return {
    name: v.name.trim(),
    slug: v.slug,
    code: v.code,
    country: v.country,
    legalFormId: v.legalFormId,
    timezone: v.timezone,
    institutionTypes: v.institutionTypes,
    parentId: v.tree === 'Child' ? optional(v.parentId) : undefined,
    identityNumber: v.identityDocument ? optional(v.identityNumber) : undefined,
    registeredOn: optional(v.registeredOn),
    taxNumber: optional(v.taxNumber),
    email: optional(v.email),
    phone: v.phone ? compactPhone(v.phone) : undefined,
  }
}
