import { createFileRoute } from '@tanstack/react-router'
import { BillingPage, BILLING_STATUS_FILTERS } from '@/features/billing/billing-page'
import type { BillingStatusFilter } from '@/features/billing/billing-page'

export type BillingSearch = { status?: BillingStatusFilter; view?: 'payments' }

// Session guard lives once in the parent _admin layout — operator AUTHORIZATION is Cerbos's job,
// enforced server-side on every AdminRoute-gated request, not here.
export const Route = createFileRoute('/_admin/billing')({
  validateSearch: (s: Record<string, unknown>): BillingSearch => ({
    status: BILLING_STATUS_FILTERS.includes(s.status as BillingStatusFilter) && s.status !== 'All' ? (s.status as BillingStatusFilter) : undefined,
    view: s.view === 'payments' ? 'payments' : undefined,
  }),
  component: BillingRoute,
})

function BillingRoute() {
  const { status, view } = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <BillingPage
      status={status ?? 'All'}
      view={view}
      onStatusChange={(next) => navigate({ search: (prev) => ({ ...prev, status: next === 'All' ? undefined : next }), replace: true })}
    />
  )
}
