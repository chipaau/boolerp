import { createFileRoute, useNavigate, redirect } from '@tanstack/react-router'
import { AuthShell, KratosForm, getSession, safeReturnTo, useKratosFlow } from '@workspace/auth'

const LOGIN_GROUPS = ['password', 'webauthn', 'passkey', 'totp', 'lookup_secret', 'code']

// Dev convenience — matches the internal operator seeded by apps/api/cmd/provision-dev. Dev-only:
// import.meta.env.DEV is inlined to `false` in production builds, so this branch is eliminated.
const DEV_CREDENTIALS = { identifier: 'user@bool.test', password: 'dev-operator-12345' }

// Operator sign-in. Same Kratos flow machinery as the tenant app (shared @workspace/auth), single
// origin admin.bool.test. Enforced-MFA + IP/VPN restrictions are hardening (later); this is the shell.
export const Route = createFileRoute('/login')({
  validateSearch: (s: Record<string, unknown>): { flow?: string; return_to?: string; aal?: 'aal2'; refresh?: 'true' } => ({
    flow: typeof s.flow === 'string' ? s.flow : undefined,
    return_to: typeof s.return_to === 'string' ? s.return_to : undefined,
    aal: s.aal === 'aal2' ? 'aal2' : undefined,
    refresh: s.refresh === 'true' ? 'true' : undefined,
  }),
  beforeLoad: async ({ search }) => {
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
    // Return to THIS origin (admin.bool.test) on success, not the base_url tenant host.
    returnTo: window.location.origin + dest,
    query: { aal, refresh },
    onSuccess: () => navigate({ to: dest }),
  })

  return (
    <AuthShell title="Operator sign in" subtitle="admin.bool.test — internal only">
      {error && <p className="mb-3 text-sm text-destructive">{error}</p>}
      {flow ? (
        <KratosForm
          flow={flow}
          onSubmit={onSubmit}
          submitting={submitting}
          groups={LOGIN_GROUPS}
          autofill={import.meta.env.DEV && aal !== 'aal2' ? DEV_CREDENTIALS : undefined}
        />
      ) : (
        <p className="text-sm text-muted-foreground">Loading…</p>
      )}
    </AuthShell>
  )
}
