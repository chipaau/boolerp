import { createFileRoute, useNavigate, Link, redirect } from '@tanstack/react-router'
import { AuthShell, KratosForm, useKratosFlow, whoami } from '@workspace/auth'

export const Route = createFileRoute('/login')({
  validateSearch: (s: Record<string, unknown>) => ({
    flow: typeof s.flow === 'string' ? s.flow : undefined,
    return_to: typeof s.return_to === 'string' ? s.return_to : undefined,
  }),
  beforeLoad: async ({ search }) => {
    // Already signed in? Skip login — go where they were headed (open-redirect guarded).
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
    // Return to THIS origin on success (Kratos validates against allowed_return_urls).
    returnTo: window.location.origin + dest,
    onSuccess: () => navigate({ to: dest }),
  })

  return (
    <AuthShell
      title="Sign in"
      subtitle="Inventory, assets and approvals for your locations."
      footer={
        <Link
          to="/recovery"
          search={{ flow: undefined }}
          className="ms-auto text-link hover:underline hover:underline-offset-[3px]"
        >
          Forgot password?
        </Link>
      }
    >
      {error && (
        <p role="alert" className="mb-3 rounded-full bg-destructive-soft px-[18px] py-3 text-[13.5px] text-destructive">
          {error}
        </p>
      )}
      {flow ? (
        <KratosForm flow={flow} onSubmit={onSubmit} submitting={submitting} groups={['password']} />
      ) : (
        <p className="text-[15px] text-muted-foreground">Loading…</p>
      )}
    </AuthShell>
  )
}
