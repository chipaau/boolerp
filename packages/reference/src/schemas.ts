// The reference lists' shapes as the API returns them (C199): hand-written zod in the API's
// camelCase, so a drift from the API is a contract error naming the field (C174).
import { z } from 'zod'
import { id, listOf } from '@workspace/api'

/** A country (GET /api/v1/countries): ISO codes, name, and international dialling prefix. */
export const countrySchema = z.object({
  code: z.string().length(2),
  alpha3: z.string().length(3),
  name: z.string(),
  phonePrefix: z.string(),
})
export type Country = z.infer<typeof countrySchema>
export const countryPageSchema = listOf(countrySchema)

export const legalFormCategories = ['government', 'private', 'non_profit', 'international'] as const

/**
 * A legal form of one country (GET /api/v1/legal-forms?country=): `identityDocument` names the
 * document whose number a tenant of this form gives, or is null when the form carries none.
 */
export const legalFormSchema = z.object({
  id,
  code: z.string(),
  name: z.string(),
  category: z.enum(legalFormCategories),
  identityDocument: z.string().nullable(),
})
export type LegalForm = z.infer<typeof legalFormSchema>
export const legalFormPageSchema = listOf(legalFormSchema)

/** An institution type with its sector (GET /api/v1/institution-types). */
export const institutionTypeSchema = z.object({
  code: z.string(),
  name: z.string(),
  sector: z.object({ code: z.string(), name: z.string() }),
})
export type InstitutionType = z.infer<typeof institutionTypeSchema>
export const institutionTypePageSchema = listOf(institutionTypeSchema)
