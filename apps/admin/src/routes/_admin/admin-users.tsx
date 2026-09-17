import { createFileRoute } from '@tanstack/react-router'
import { AdminUsersPage } from '@/features/admin-users/admin-users-page'
import type { InviteState } from '@/features/admin-users/types'

// ?invite=Accepted|Invited|Expired preselects the invite filter (the attention list links to Invited).
export const Route = createFileRoute('/_admin/admin-users')({
  validateSearch: (s: Record<string, unknown>): { invite?: InviteState } => ({
    invite: s.invite === 'Accepted' || s.invite === 'Invited' || s.invite === 'Expired' ? s.invite : undefined,
  }),
  component: AdminUsersRoute,
})

function AdminUsersRoute() {
  const { invite } = Route.useSearch()
  return <AdminUsersPage key={invite ?? ''} initialInvite={invite} />
}
