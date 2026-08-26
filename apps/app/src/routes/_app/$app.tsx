import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { SidebarInset } from '@workspace/ui/components/sidebar'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { DEFAULT_APP, getApp } from '@/lib/apps'

// One dynamic route serves every app: resolve its config from the slug, render its sidebar + content.
export const Route = createFileRoute('/_app/$app')({
  beforeLoad: ({ params }) => {
    if (!getApp(params.app)) {
      throw redirect({ to: '/$app', params: { app: DEFAULT_APP } })
    }
  },
  component: AppShell,
})

function AppShell() {
  const { app } = Route.useParams()
  const cfg = getApp(app)!
  return (
    <>
      <AppSidebar app={cfg} />
      <SidebarInset className="min-h-0 overflow-y-auto">
        <Outlet />
      </SidebarInset>
    </>
  )
}
