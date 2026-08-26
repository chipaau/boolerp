import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { whoami } from '@workspace/auth'
import { SidebarProvider } from '@workspace/ui/components/sidebar'
import { SiteHeader } from '@/components/layout/site-header'
import { UserProvider } from '@/components/layout/user-context'

// Authenticated workspace layout: session guard + the shell chrome (header over a sidebar area).
export const Route = createFileRoute('/_app')({
  loader: async () => {
    const session = await whoami()
    if (!session) {
      const returnTo = window.location.pathname + window.location.search
      throw redirect({ to: '/login', search: { return_to: returnTo } })
    }
    const traits = session.identity.traits as Record<string, unknown>
    return { user: { name: String(traits.name ?? 'User'), email: String(traits.email ?? '') } }
  },
  component: AppLayout,
})

function AppLayout() {
  const { user } = Route.useLoaderData()
  return (
    <UserProvider user={user}>
      <div className="fixed inset-0 overflow-hidden">
        <SidebarProvider className="flex flex-col">
          <SiteHeader />
          <div className="flex h-[calc(100svh-3.5rem)] min-h-0">
            <Outlet />
          </div>
        </SidebarProvider>
      </div>
    </UserProvider>
  )
}
