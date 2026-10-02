import { Outlet, createFileRoute, useLocation } from '@tanstack/react-router'
import { SidebarInset, SidebarProvider } from '@workspace/ui/components/sidebar'
import { ToastProvider } from '@workspace/ui/components/toast'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { SiteHeader } from '@/components/layout/site-header'
import { UserProvider } from '@/components/layout/user-context'
import { currentUser, signIn } from '@workspace/session'
import { getApp } from '@/lib/apps'

// Authenticated workspace layout: session guard + the shell chrome (header over a sidebar area).
export const Route = createFileRoute('/_app')({
  loader: async () => {
    // No session → the BFF's sign-in, returning here afterwards.
    const me = await currentUser()
    if (!me) return signIn()
    return { user: { name: me.displayName || me.email, email: me.email } }
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
            <AppFrame />
          </div>
        </SidebarProvider>
      </div>
      </ToastProvider>
    </UserProvider>
  )
}

// Inside an app (/<slug>/…), the shell draws that app's sidebar around the page, whether the app
// is a package with its own routes (C102) or a prototype served by the $app routes; app packages
// never render shell chrome themselves.
function AppFrame() {
  const slug = useLocation({ select: (l) => l.pathname.split('/')[1] ?? '' })
  const app = getApp(slug)
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
