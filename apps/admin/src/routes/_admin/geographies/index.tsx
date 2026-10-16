import { createFileRoute, redirect } from '@tanstack/react-router'

// /geographies opens its first tab (C218). An old link's ?tab=countries still lands on that tab.
export const Route = createFileRoute('/_admin/geographies/')({
  validateSearch: (s: Record<string, unknown>): { tab?: string } => ({ tab: typeof s.tab === 'string' ? s.tab : undefined }),
  beforeLoad: ({ search }) => {
    throw redirect({ to: search.tab === 'countries' ? '/geographies/countries' : '/geographies/geographies', replace: true })
  },
})
