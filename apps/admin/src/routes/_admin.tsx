import { Outlet, createFileRoute } from '@tanstack/react-router'
import { SidebarInset, SidebarProvider } from '@workspace/ui/components/sidebar'
import { AdminSidebar } from '@/components/layout/admin-sidebar'
import { AdminSearchProvider } from '@/components/layout/search-context'
import { SiteHeader } from '@/components/layout/site-header'
import { UserProvider } from '@/components/layout/user-context'
import { currentUser, signIn } from '@workspace/session'

// Authenticated console layout: session guard (once, here — not per-page) + the shell chrome
// (header over a sidebar area), same shape as apps/app's _app.tsx.
export const Route = createFileRoute('/_admin')({
  loader: async () => {
    // No session → the BFF's sign-in (bff-admin), returning here afterwards.
    const me = await currentUser()
    if (!me) return signIn()
    return { user: { name: me.displayName || me.email, email: me.email } }
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
