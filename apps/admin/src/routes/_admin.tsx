import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { getSession } from '@workspace/auth'
import { SidebarInset, SidebarProvider } from '@workspace/ui/components/sidebar'
import { AdminSidebar } from '@/components/layout/admin-sidebar'
import { AdminSearchProvider } from '@/components/layout/search-context'
import { SiteHeader } from '@/components/layout/site-header'
import { UserProvider } from '@/components/layout/user-context'

// Authenticated console layout: session guard (once, here — not per-page) + the shell chrome
// (header over a sidebar area), same shape as apps/app's _app.tsx.
export const Route = createFileRoute('/_admin')({
  loader: async () => {
    const state = await getSession()
    if (state.status !== 'active') {
      const returnTo = window.location.pathname + window.location.search
      throw redirect({
        to: '/login',
        search: { flow: undefined, return_to: returnTo, aal: state.status === 'aal2_required' ? 'aal2' : undefined, refresh: undefined },
      })
    }
    const traits = state.session.identity.traits
    return { user: { name: String(traits.name ?? 'Operator'), email: String(traits.email ?? '') } }
  },
  component: AdminLayout,
})

function AdminLayout() {
  const { user } = Route.useLoaderData()
  return (
    <UserProvider user={user}>
      <AdminSearchProvider>
        <div className="fixed inset-0 overflow-hidden">
          <SidebarProvider className="flex flex-col">
            <SiteHeader />
            <div className="flex h-[calc(100svh-var(--header-height))] min-h-0">
              <AdminSidebar />
              <SidebarInset className="min-h-0 overflow-y-auto">
                <Outlet />
              </SidebarInset>
            </div>
          </SidebarProvider>
        </div>
      </AdminSearchProvider>
    </UserProvider>
  )
}
