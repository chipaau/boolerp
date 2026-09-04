import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { getSession } from '@workspace/auth'
import { SidebarProvider } from '@workspace/ui/components/sidebar'
import { ToastProvider } from '@workspace/ui/components/toast'
import { SiteHeader } from '@/components/layout/site-header'
import { UserProvider } from '@/components/layout/user-context'

// Authenticated workspace layout: session guard + the shell chrome (header over a sidebar area).
export const Route = createFileRoute('/_app')({
  loader: async () => {
    const state = await getSession()
    if (state.status !== 'active') {
      // no session → sign in; first factor done but MFA enrolled → complete the second factor (UC-AUTH-04)
      const returnTo = window.location.pathname + window.location.search
      throw redirect({
        to: '/login',
        search: { flow: undefined, return_to: returnTo, aal: state.status === 'aal2_required' ? 'aal2' : undefined, refresh: undefined },
      })
    }
    const traits = state.session.identity.traits
    return { user: { name: String(traits.name ?? 'User'), email: String(traits.email ?? '') } }
  },
  component: AppLayout,
})

function AppLayout() {
  const { user } = Route.useLoaderData()
  return (
    <UserProvider user={user}>
      <ToastProvider>
      <div className="fixed inset-0 overflow-hidden">
        <SidebarProvider className="flex flex-col">
          <SiteHeader />
          <div className="flex h-[calc(100svh-var(--header-height))] min-h-0">
            <Outlet />
          </div>
        </SidebarProvider>
      </div>
      </ToastProvider>
    </UserProvider>
  )
}
