import { Outlet, createFileRoute } from '@tanstack/react-router'
import { SidebarInset, SidebarProvider } from '@workspace/ui/components/sidebar'
import { AdminSidebar } from '@/components/layout/admin-sidebar'
import { AdminSearchProvider } from '@/components/layout/search-context'
import { SiteHeader } from '@/components/layout/site-header'
import { UserProvider } from '@/components/layout/user-context'
import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { meQuery, signIn } from '@workspace/session'
import type { Me } from '@workspace/session'

// Authenticated console layout: session guard (once, here — not per-page) + the shell chrome
// (header over a sidebar area), same shape as apps/app's _app.tsx.
export const Route = createFileRoute('/_admin')({
  loader: async ({ context }) => {
    // No session → the BFF's sign-in (bff-admin), returning here afterwards.
    const me = await context.queryClient.ensureQueryData(meQuery())
    if (!me) return signIn()
  },
  component: AdminLayout,
})

// The person comes from the session query, so a photo changed in the other app shows when this
// tab is focused again (C196); a session that has ended goes back through sign-in.
const toUser = (me: Me) => ({ name: me.displayName || me.email, email: me.email, photo: me.avatarUrl })

function AdminLayout() {
  const me = useQuery(meQuery()).data
  useEffect(() => {
    if (me === null) void signIn()
  }, [me])
  if (!me) return null
  const user = toUser(me)
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
