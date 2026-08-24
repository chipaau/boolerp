import { createFileRoute, useNavigate, redirect } from '@tanstack/react-router'
import { AuthShell, KratosForm, useKratosFlow, whoami } from '@workspace/auth'

// Operator sign-in. Same Kratos flow machinery as the tenant app (shared @workspace/auth), single
// origin admin.bool.test. Enforced-MFA + IP/VPN restrictions are hardening (later); this is the shell.
export const Route = createFileRoute('/login')({
  validateSearch: (s: Record<string, unknown>) => ({
    flow: typeof s.flow === 'string' ? s.flow : undefined,
    return_to: typeof s.return_to === 'string' ? s.return_to : undefined,
  }),
  beforeLoad: async ({ search }) => {
    if (await whoami()) {
      throw redirect({ to: search.return_to && search.return_to.startsWith('/') ? search.return_to : '/' })
    }
  },
  component: LoginPage,
})

function LoginPage() {
  const { flow: flowId, return_to } = Route.useSearch()
  const navigate = useNavigate()
  const dest = return_to && return_to.startsWith('/') ? return_to : '/'
  const { flow, submitting, error, onSubmit } = useKratosFlow('login', {
    flowId,
    // Return to THIS origin (admin.bool.test) on success, not the base_url tenant host.
    returnTo: window.location.origin + dest,
    onSuccess: () => navigate({ to: dest }),
  })

  return (
    <AuthShell title="Operator sign in" subtitle="admin.bool.test — internal only">
      {error && <p className="mb-3 text-sm text-destructive">{error}</p>}
      {flow ? (
        <KratosForm flow={flow} onSubmit={onSubmit} submitting={submitting} groups={['password']} />
      ) : (
        <p className="text-sm text-muted-foreground">Loading…</p>
      )}
    </AuthShell>
  )
}
