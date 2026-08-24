import { createFileRoute, redirect } from '@tanstack/react-router'
import { Button } from '@workspace/ui/components/button'
import { createLogoutFlow, whoami } from '@workspace/auth'

// Operator console (stub). Session guard ONLY for now — operator AUTHORIZATION (is this identity an
// internal operator?) requires the internal-tenant model (04) + Cerbos (05). Provisioning, suspension,
// and support/impersonation UIs arrive with those components.
export const Route = createFileRoute('/')({
  loader: async () => {
    const session = await whoami()
    if (!session) {
      throw redirect({ to: '/login', search: { return_to: '/' } })
    }
    return { session }
  },
  component: Console,
})

function Console() {
  const { session } = Route.useLoaderData()
  const email = String((session.identity.traits as Record<string, unknown>).email ?? '')

  async function logout() {
    const flow = await createLogoutFlow()
    if (flow?.logout_url) window.location.href = flow.logout_url
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-semibold">go-erp · Operator Console</h1>
      <p className="text-muted-foreground">Signed in as {email}</p>
      <p className="max-w-xs text-center text-sm text-muted-foreground">
        Provisioning, suspension, and support tools arrive with components 04 &amp; 05.
      </p>
      <Button variant="outline" onClick={logout}>
        Log out
      </Button>
    </div>
  )
}
