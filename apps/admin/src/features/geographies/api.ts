// The geographies screen's API calls, all of them, in one place (C184): keys and queryOptions
// builders for the route loaders and the screens. Components never call the API directly. (The
// geographies tab is still the design prototype's fixtures, in queries.ts.)
import { keepPreviousData, queryOptions } from '@tanstack/react-query'
import { api, createKeys } from '@workspace/api'
import { countryPageSchema, geographyPageSchema, geographyTypePageSchema } from '@workspace/reference/schemas'
import type { CountryListSearch, GeographyListSearch, GeographyTypeListSearch } from './schemas'

export const countryKeys = createKeys('admin', 'countries')
export const geographyTypeKeys = createKeys('admin', 'geography-types')
export const geographyKeys = createKeys('admin', 'geographies')

export const geographyQueries = {
  /** One page of the places at every level, of a country and a type when given (GET /api/v1/geographies, C221). */
  list: (search: GeographyListSearch) =>
    queryOptions({
      queryKey: geographyKeys.list(search),
      queryFn: ({ signal }) => api.get('/api/v1/geographies', { query: search, signal, schema: geographyPageSchema }),
      placeholderData: keepPreviousData,
    }),
}

export const countryQueries = {
  /** One page of the current countries, each with how many places it lists (GET /api/v1/countries). */
  list: (search: CountryListSearch) =>
    queryOptions({
      queryKey: countryKeys.list(search),
      queryFn: ({ signal }) => api.get('/api/v1/countries', { query: search, signal, schema: countryPageSchema }),
      placeholderData: keepPreviousData,
    }),
}

export const geographyTypeQueries = {
  /** One page of the address levels, every country's or one's, with their place counts (GET /api/v1/geography-types). */
  list: (search: GeographyTypeListSearch) =>
    queryOptions({
      queryKey: geographyTypeKeys.list(search),
      queryFn: ({ signal }) => api.get('/api/v1/geography-types', { query: search, signal, schema: geographyTypePageSchema }),
      placeholderData: keepPreviousData,
    }),
}
