import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { AuthShell } from '@/components/auth-shell'
import { KratosForm } from '@/components/kratos-form'
import { useKratosFlow } from '@/lib/use-flow'

export const Route = createFileRoute('/login')({
  validateSearch: (s: Record<string, unknown>) => ({
    flow: typeof s.flow === 'string' ? s.flow : undefined,
    return_to: typeof s.return_to === 'string' ? s.return_to : undefined,
  }),
  component: LoginPage,
})

function LoginPage() {
  const { flow: flowId, return_to } = Route.useSearch()
  const navigate = useNavigate()
  const { flow, submitting, error, onSubmit } = useKratosFlow('login', {
    flowId,
    // Kratos validates return_to server-side; we only follow same-origin paths (open-redirect guard).
    onSuccess: () => navigate({ to: return_to && return_to.startsWith('/') ? return_to : '/' }),
  })

  return (
    <AuthShell
      title="Sign in"
      subtitle="malecouncil.bool.test"
      footer={
        <Link to="/recovery" className="underline">
          Forgot password?
        </Link>
      }
    >
      {error && <p className="mb-3 text-sm text-destructive">{error}</p>}
      {flow ? (
        <KratosForm flow={flow} onSubmit={onSubmit} submitting={submitting} groups={['password']} />
      ) : (
        <p className="text-sm text-muted-foreground">Loading…</p>
      )}
    </AuthShell>
  )
}
