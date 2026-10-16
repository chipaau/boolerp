// The reference lists' shapes as the API returns them (C199): hand-written zod in the API's
// camelCase, so a drift from the API is a contract error naming the field (C174).
import { z } from 'zod'
import { id, listOf } from '@workspace/api'

/**
 * A country (GET /api/v1/countries): ISO codes, name, international dialling prefix, and how many
 * current places it lists for address pickers (C215).
 */
export const countrySchema = z.object({
  code: z.string().length(2),
  alpha3: z.string().length(3),
  name: z.string(),
  phonePrefix: z.string(),
  geographyCount: z.number().int().nonnegative(),
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

/**
 * A country's address level (GET /api/v1/geography-types, C215): its level (1 under the country),
 * the label a form shows, and how many current places of it are listed (none: the level is typed).
 */
export const geographyTypeSchema = z.object({
  id,
  country: z.string().length(2),
  code: z.string(),
  name: z.string(),
  level: z.number().int().min(1).max(9),
  placeCount: z.number().int().nonnegative(),
})
export type GeographyType = z.infer<typeof geographyTypeSchema>
export const geographyTypePageSchema = listOf(geographyTypeSchema)

/**
 * A place addresses pick from (GET /api/v1/geographies, C215, C221): its type and level, its
 * country and parent, its point, and how many current places are under it (the next picker's).
 */
export const geographySchema = z.object({
  id,
  type: z.string(),
  typeName: z.string(),
  level: z.number().int().min(1).max(9),
  country: z.string().length(2),
  code: z.string().nullable(),
  name: z.string(),
  shortName: z.string().nullable(),
  parentId: id.nullable(),
  parentName: z.string().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  childCount: z.number().int().nonnegative(),
  hasChildren: z.boolean(),
})
export type Geography = z.infer<typeof geographySchema>
export const geographyPageSchema = listOf(geographySchema)
