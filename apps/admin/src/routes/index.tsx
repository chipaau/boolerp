import { createFileRoute, redirect } from '@tanstack/react-router'
import { Button } from '@workspace/ui/components/button'
import { getSession, logout } from '@workspace/auth'

// Operator console (stub). Session guard ONLY for now — operator AUTHORIZATION (is this identity an
// internal operator?) requires the internal-tenant model (04) + Cerbos (05). Provisioning, suspension,
// and support/impersonation UIs arrive with those components.
export const Route = createFileRoute('/')({
  loader: async () => {
    const state = await getSession()
    if (state.status !== 'active') {
      throw redirect({
        to: '/login',
        search: { flow: undefined, return_to: '/', aal: state.status === 'aal2_required' ? 'aal2' : undefined, refresh: undefined },
      })
    }
    return { session: state.session }
  },
  component: Console,
})

function Console() {
  const { session } = Route.useLoaderData()
  const email = String(session.identity.traits.email ?? '')

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-semibold">go-erp · Operator Console</h1>
      <p className="text-muted-foreground">Signed in as {email}</p>
      <p className="max-w-xs text-center text-sm text-muted-foreground">
        Provisioning, suspension, and support tools arrive with components 04 &amp; 05.
      </p>
      <Button variant="outline" onClick={() => logout()}>
        Log out
      </Button>
    </div>
  )
}
