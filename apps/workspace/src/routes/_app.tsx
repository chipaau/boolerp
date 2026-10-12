import { Outlet, createFileRoute } from '@tanstack/react-router'
import { SidebarInset, SidebarProvider } from '@workspace/ui/components/sidebar'
import { ToastProvider } from '@workspace/ui/components/toast'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { SiteHeader } from '@/components/layout/site-header'
import { UserProvider } from '@/components/layout/user-context'
import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { meQuery, signIn } from '@workspace/session'
import type { Me } from '@workspace/session'
import { useCurrentApp } from '@/lib/apps'

// Authenticated workspace layout: session guard + the shell chrome (header over a sidebar area).
export const Route = createFileRoute('/_app')({
  loader: async ({ context }) => {
    // No session → the BFF's sign-in, returning here afterwards.
    const me = await context.queryClient.ensureQueryData(meQuery())
    if (!me) return signIn()
  },
  component: AppLayout,
})

// The person comes from the session query, so a photo changed in the other app shows when this
// tab is focused again (C196); a session that has ended goes back through sign-in.
const toUser = (me: Me) => ({ name: me.displayName || me.email, email: me.email, photo: me.avatarUrl })

function AppLayout() {
  const me = useQuery(meQuery()).data
  useEffect(() => {
    if (me === null) void signIn()
  }, [me])
  if (!me) return null
  const user = toUser(me)
  return (
    <UserProvider user={user}>
      <ToastProvider>
      <div className="fixed inset-0 overflow-hidden">
        <SidebarProvider className="flex flex-col">
          <SiteHeader />
          <div className="flex h-[calc(100svh-var(--header-height))] min-h-0">
            <AppFrame />
          </div>
        </SidebarProvider>
      </div>
      </ToastProvider>
    </UserProvider>
  )
}

// The top bar (SiteHeader, above) is the workspace's: the same for every app and never changed by
// one. Inside an app (/<slug>/…), the shell draws that app's sidebar around the page, whether the
// app is a package with its own routes (C102) or a prototype served by the $app routes; app
// packages never render shell chrome themselves.
function AppFrame() {
  const app = useCurrentApp()
  if (!app) return <Outlet />
  return (
    <>
      <AppSidebar app={app} />
      <SidebarInset className="min-h-0 overflow-y-auto">
        <Outlet />
      </SidebarInset>
    </>
  )
}
