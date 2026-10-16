// The geographies screen's URL state (C174): the tab is the path (/geographies/countries, C218), and
// the countries list's page, pageSize, q, and sort are its search, named as the API names them. The
// countries' shape is @workspace/reference's countrySchema, which the API's answers are parsed with.
// (types.ts holds the design prototype's fixture types, which the geographies tab still uses.)
import type { z } from 'zod'
import { listSearch } from '@workspace/api'

export const geographiesTabs = ['geographies', 'countries'] as const
export type GeographiesTab = (typeof geographiesTabs)[number]

/** The countries list's sort fields: the API's. */
export const countrySorts = ['name', 'code'] as const

/** The countries list's URL: page, pageSize, q, and sort. */
export const countryListSearch = listSearch({ sorts: countrySorts })
export type CountryListSearch = z.infer<typeof countryListSearch>
