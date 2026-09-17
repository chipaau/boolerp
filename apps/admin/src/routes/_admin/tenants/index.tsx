import { createFileRoute } from '@tanstack/react-router'
import { TenantsPage } from '@/features/tenants/tenants-page'

// Session guard lives once in the parent _admin layout — operator AUTHORIZATION is Cerbos's job,
// enforced server-side on every AdminRoute-gated request, not here.
// The list lives at tenants/index so tenants/$slug can sit beside it without a layout route.
export const Route = createFileRoute('/_admin/tenants/')({
  component: TenantsPage,
})
