import { createFileRoute } from '@tanstack/react-router'
import { GeographiesPage } from '@/features/geographies/geographies-page'
import type { GeographiesTab } from '@/features/geographies/geographies-page'

// ?tab=places|countries (the attention list links to tab=places).
export const Route = createFileRoute('/_admin/geographies')({
  validateSearch: (s: Record<string, unknown>): { tab?: GeographiesTab } => ({
    tab: s.tab === 'countries' || s.tab === 'places' ? s.tab : undefined,
  }),
  component: GeographiesRoute,
})

function GeographiesRoute() {
  const { tab } = Route.useSearch()
  const navigate = Route.useNavigate()
  return <GeographiesPage tab={tab ?? 'places'} onTabChange={(next) => navigate({ search: { tab: next }, replace: true })} />
}
