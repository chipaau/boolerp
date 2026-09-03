import { createFileRoute, useNavigate, Link, redirect } from '@tanstack/react-router'
import { AuthShell, KratosForm, getSession, safeReturnTo, useKratosFlow } from '@workspace/auth'

// Node groups a login screen may show: first factor (password, passkey / security key) and the
// second-factor step (authenticator code, backup code) when Kratos asks for aal2.
const LOGIN_GROUPS = ['password', 'webauthn', 'passkey', 'totp', 'lookup_secret', 'code']

export const Route = createFileRoute('/login')({
  validateSearch: (s: Record<string, unknown>): { flow?: string; return_to?: string; aal?: 'aal2'; refresh?: 'true' } => ({
    flow: typeof s.flow === 'string' ? s.flow : undefined,
    return_to: typeof s.return_to === 'string' ? s.return_to : undefined,
    // aal=aal2: the second-factor step; refresh=true: re-authenticate for a privileged action
    aal: s.aal === 'aal2' ? 'aal2' : undefined,
    refresh: s.refresh === 'true' ? 'true' : undefined,
  }),
  beforeLoad: async ({ search }) => {
    // Fully signed in? Skip login — go where they were headed (open-redirect guarded). A session
    // that still needs its second factor stays here to complete it.
    if (search.refresh) return
    const state = await getSession()
    if (state.status === 'active') throw redirect({ to: safeReturnTo(search.return_to) })
  },
  component: LoginPage,
})

function LoginPage() {
  const { flow: flowId, return_to, aal, refresh } = Route.useSearch()
  const navigate = useNavigate()
  const dest = safeReturnTo(return_to)
  const { flow, submitting, error, onSubmit } = useKratosFlow('login', {
    flowId,
    // Return to THIS origin on success (Kratos validates against allowed_return_urls).
    returnTo: window.location.origin + dest,
    query: { aal, refresh },
    onSuccess: () => navigate({ to: dest }),
  })
  const secondFactor = aal === 'aal2'

  return (
    <AuthShell
      title={secondFactor ? 'One more step' : 'Sign in'}
      subtitle={secondFactor ? 'Enter the code from your authenticator app, or use a backup code.' : 'Inventory, assets and approvals for your locations.'}
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
        <KratosForm flow={flow} onSubmit={onSubmit} submitting={submitting} groups={LOGIN_GROUPS} />
      ) : (
        <p className="text-[15px] text-muted-foreground">Loading…</p>
      )}
    </AuthShell>
  )
}
