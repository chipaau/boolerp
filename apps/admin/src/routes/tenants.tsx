import { createFileRoute, redirect } from '@tanstack/react-router'
import { getSession } from '@workspace/auth'
import { TenantsPage } from '@/features/tenants/tenants-page'

// Session guard only — operator AUTHORIZATION is Cerbos's job, enforced server-side on every
// request (AdminRoute). A non-operator sees this page load fine but every action 403s; a real
// "you're signed in but not an operator" screen is future polish, not a security gap.
export const Route = createFileRoute('/tenants')({
  loader: async () => {
    const state = await getSession()
    if (state.status !== 'active') {
      throw redirect({
        to: '/login',
        search: { flow: undefined, return_to: '/tenants', aal: state.status === 'aal2_required' ? 'aal2' : undefined, refresh: undefined },
      })
    }
    return { session: state.session }
  },
  component: TenantsPage,
})
