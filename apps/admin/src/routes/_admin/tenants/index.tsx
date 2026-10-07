import { createFileRoute } from '@tanstack/react-router'
import { tenantQueries } from '@/features/tenants/api'
import { tenantListSearch } from '@/features/tenants/schemas'
import { TenantsList } from '@/features/tenants/tenants-list'

// The tenants list (C174): its state is the URL, validated here and prefetched by the loader. The
// session guard is the _admin layout; Cerbos decides access on the API (C178, C179).
export const Route = createFileRoute('/_admin/tenants/')({
  validateSearch: tenantListSearch,
  loaderDeps: ({ search }) => search,
  // Prefetch without throwing: a 403 or failure shows in the list's own states (C185).
  loader: ({ context, deps }) => context.queryClient.prefetchQuery(tenantQueries.list(deps)),
  component: TenantsList,
})
