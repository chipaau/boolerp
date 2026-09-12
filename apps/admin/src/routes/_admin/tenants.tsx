import { createFileRoute } from '@tanstack/react-router'
import { TenantsPage } from '@/features/tenants/tenants-page'

// Session guard lives once in the parent _admin layout — operator AUTHORIZATION is Cerbos's job,
// enforced server-side on every AdminRoute-gated request, not here.
export const Route = createFileRoute('/_admin/tenants')({
  component: TenantsPage,
})
