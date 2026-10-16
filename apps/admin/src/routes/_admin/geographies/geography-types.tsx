import { createFileRoute } from '@tanstack/react-router'
import { referenceQueries } from '@workspace/reference/api'
import { geographyTypeQueries } from '@/features/geographies/api'
import { GeographyTypesPage } from '@/features/geographies/geography-types-list'
import { geographyTypeListSearch } from '@/features/geographies/schemas'

// The geography types tab (C174, C218, C220): its state is the URL, validated here and prefetched by
// the loader, with the countries the filter and the Country column name.
export const Route = createFileRoute('/_admin/geographies/geography-types')({
  validateSearch: geographyTypeListSearch,
  loaderDeps: ({ search }) => search,
  // Prefetch without throwing: a 403 or failure shows in the list's own states (C185).
  loader: ({ context, deps }) =>
    Promise.all([
      context.queryClient.prefetchQuery(geographyTypeQueries.list(deps)),
      context.queryClient.prefetchQuery(referenceQueries.countries()),
    ]),
  component: GeographyTypesPage,
})
