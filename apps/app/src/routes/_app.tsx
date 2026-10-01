import { Outlet, createFileRoute } from '@tanstack/react-router'
import { SidebarProvider } from '@workspace/ui/components/sidebar'
import { ToastProvider } from '@workspace/ui/components/toast'
import { SiteHeader } from '@/components/layout/site-header'
import { UserProvider } from '@/components/layout/user-context'
import { currentUser, signIn } from '@/lib/session'

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
            <Outlet />
          </div>
        </SidebarProvider>
      </div>
      </ToastProvider>
    </UserProvider>
  )
}
