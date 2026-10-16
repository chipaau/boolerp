// The geographies screen's URL state (C174): the tab is the path (/geographies/countries, C218), and
// each list's page, pageSize, q, sort, and filters are its search, named as the API names them. The
// shapes are @workspace/reference's (countrySchema, geographyTypeSchema), which the API's answers are
// parsed with.
// (types.ts holds the design prototype's fixture types, which the geographies tab still uses.)
import { z } from 'zod'
import { listSearch } from '@workspace/api'

export const geographiesTabs = ['geographies', 'countries', 'geography-types'] as const
export type GeographiesTab = (typeof geographiesTabs)[number]

/** The countries list's sort fields: the API's. */
export const countrySorts = ['name', 'code'] as const

/** The countries list's URL: page, pageSize, q, and sort. */
export const countryListSearch = listSearch({ sorts: countrySorts })
export type CountryListSearch = z.infer<typeof countryListSearch>

/** The geographies list's sort fields: the API's (C221). */
export const geographySorts = ['country', 'level', 'name', 'code'] as const

/** The geographies list's URL: page, pageSize, q, sort, and the country and type filters. */
export const geographyListSearch = listSearch({ sorts: geographySorts }).extend({
  country: z.string().regex(/^[A-Z]{2}$/).optional().catch(undefined),
  type: z.string().regex(/^[a-z][a-z0-9_]{1,49}$/).optional().catch(undefined),
})
export type GeographyListSearch = z.infer<typeof geographyListSearch>

/** The geography types list's sort fields: the API's (C220). */
export const geographyTypeSorts = ['country', 'level', 'name', 'code'] as const

/** The geography types list's URL: page, pageSize, q, sort, and the country filter. */
export const geographyTypeListSearch = listSearch({ sorts: geographyTypeSorts }).extend({
  country: z.string().regex(/^[A-Z]{2}$/).optional().catch(undefined),
})
export type GeographyTypeListSearch = z.infer<typeof geographyTypeListSearch>
