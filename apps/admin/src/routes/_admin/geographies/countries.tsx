import { createFileRoute } from '@tanstack/react-router'
import { countryQueries } from '@/features/geographies/api'
import { CountriesPage } from '@/features/geographies/countries-list'
import { countryListSearch } from '@/features/geographies/schemas'

// The countries tab (C174, C218): its state is the URL, validated here and prefetched by the loader.
export const Route = createFileRoute('/_admin/geographies/countries')({
  validateSearch: countryListSearch,
  loaderDeps: ({ search }) => search,
  // Prefetch without throwing: a 403 or failure shows in the list's own states (C185).
  loader: ({ context, deps }) => context.queryClient.prefetchQuery(countryQueries.list(deps)),
  component: CountriesPage,
})
