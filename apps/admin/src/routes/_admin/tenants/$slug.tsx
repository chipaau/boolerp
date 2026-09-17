import { createFileRoute } from '@tanstack/react-router'
import { TENANT_TABS, TenantDetailPage } from '@/features/tenants/tenant-detail-page'
import type { TenantTab } from '@/features/tenants/tenant-detail-page'

type TenantSearch = { tab?: TenantTab }

const isTab = (v: unknown): v is TenantTab => TENANT_TABS.some(([k]) => k === v)

// The open tab is in the URL so billing and attention links can land on a specific tab.
export const Route = createFileRoute('/_admin/tenants/$slug')({
  validateSearch: (search: Record<string, unknown>): TenantSearch => (isTab(search.tab) && search.tab !== 'overview' ? { tab: search.tab } : {}),
  component: TenantDetailRoute,
})

function TenantDetailRoute() {
  const { slug } = Route.useParams()
  const { tab = 'overview' } = Route.useSearch()
  const navigate = Route.useNavigate()
  return <TenantDetailPage slug={slug} tab={tab} onTabChange={(next) => void navigate({ search: next === 'overview' ? {} : { tab: next }, replace: true })} />
}
