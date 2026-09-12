import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { Button } from '@workspace/ui/components/button'
import { getSession, logout } from '@workspace/auth'

// Operator console home. Session guard ONLY — operator AUTHORIZATION is Cerbos's job (04 + 05),
// enforced per-handler server-side, not here.
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
      <Button render={<Link to="/tenants" />}>Manage tenants</Button>
      <Button variant="outline" onClick={() => logout()}>
        Log out
      </Button>
    </div>
  )
}
