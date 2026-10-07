import { createFileRoute } from '@tanstack/react-router'
import { TenantsPage } from '@/features/tenants/tenants-page'

// The design prototype of the tenants list, moved here unchanged while the API-backed list takes
// /tenants (C187); removed once that list is accepted.
export const Route = createFileRoute('/_admin/tenants-prototype')({
  component: TenantsPage,
})
