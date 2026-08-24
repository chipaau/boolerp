import { createFileRoute, redirect } from '@tanstack/react-router'
import { Button } from '@workspace/ui/components/button'
import { createLogoutFlow, whoami } from '@workspace/auth'

// Protected home. The session guard sends unauthenticated visitors to /login, preserving the deep
// link via return_to (UC-AUTH-08 / UC-AUTH-12). A full bootstrap (tenant + memberships) lands with 03/04.
export const Route = createFileRoute('/')({
  loader: async () => {
    const session = await whoami()
    if (!session) {
      throw redirect({ to: '/login', search: { return_to: '/' } })
    }
    return { session }
  },
  component: Home,
})

function Home() {
  const { session } = Route.useLoaderData()
  const email = String((session.identity.traits as Record<string, unknown>).email ?? '')

  async function logout() {
    const flow = await createLogoutFlow()
    if (flow?.logout_url) window.location.href = flow.logout_url
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-semibold">go-erp</h1>
      <p className="text-muted-foreground">Signed in as {email}</p>
      <Button variant="outline" onClick={logout}>
        Log out
      </Button>
    </div>
  )
}
