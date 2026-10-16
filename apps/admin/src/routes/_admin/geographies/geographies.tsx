import { createFileRoute } from '@tanstack/react-router'
import { referenceQueries } from '@workspace/reference/api'
import { geographyQueries } from '@/features/geographies/api'
import { GeographiesPage } from '@/features/geographies/geographies-list'
import { geographyListSearch } from '@/features/geographies/schemas'

// The geographies tab (C174, C218, C221): its state is the URL, validated here and prefetched by the
// loader, with the countries the filter and the Country column name.
export const Route = createFileRoute('/_admin/geographies/geographies')({
  validateSearch: geographyListSearch,
  loaderDeps: ({ search }) => search,
  // Prefetch without throwing: a 403 or failure shows in the list's own states (C185).
  loader: ({ context, deps }) =>
    Promise.all([
      context.queryClient.prefetchQuery(geographyQueries.list(deps)),
      context.queryClient.prefetchQuery(referenceQueries.countries()),
    ]),
  component: GeographiesPage,
})
