// The reference lists' API calls, all of them, in one place (C184). Reference data changes only
// with a release or an operator's edit, so a list is fetched once and kept for the session.
import { queryOptions } from '@tanstack/react-query'
import { api, createKeys } from '@workspace/api'
import { countryPageSchema, institutionTypePageSchema, legalFormPageSchema } from './schemas'

export const referenceKeys = {
  countries: createKeys('reference', 'countries'),
  legalForms: createKeys('reference', 'legal-forms'),
  institutionTypes: createKeys('reference', 'institution-types'),
}

/** Each list arrives in one page: the API allows 300 countries and 100 of the rest. */
const COUNTRIES_PAGE = 300
const PAGE = 100
const staleTime = Infinity

export const referenceQueries = {
  /** Every current country, by name. */
  countries: () =>
    queryOptions({
      queryKey: referenceKeys.countries.list({}),
      queryFn: ({ signal }) => api.get('/api/v1/countries', { query: { pageSize: COUNTRIES_PAGE }, signal, schema: countryPageSchema }),
      select: (page) => page.items,
      staleTime,
    }),
  /** One country's current legal forms, by name. */
  legalForms: (country: string) =>
    queryOptions({
      queryKey: referenceKeys.legalForms.list({ country }),
      queryFn: ({ signal }) => api.get('/api/v1/legal-forms', { query: { country, pageSize: PAGE }, signal, schema: legalFormPageSchema }),
      select: (page) => page.items,
      staleTime,
      enabled: !!country,
    }),
  /** Every current institution type, by sector then name. */
  institutionTypes: () =>
    queryOptions({
      queryKey: referenceKeys.institutionTypes.list({}),
      queryFn: ({ signal }) => api.get('/api/v1/institution-types', { query: { pageSize: PAGE }, signal, schema: institutionTypePageSchema }),
      select: (page) => page.items,
      staleTime,
    }),
}
