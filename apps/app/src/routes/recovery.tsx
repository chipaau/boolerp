import { createFileRoute, Link } from '@tanstack/react-router'
import { AuthShell } from '@workspace/auth'
import { KratosForm } from '@workspace/auth'
import { useKratosFlow } from '@workspace/auth'

// Recovery doubles as activation: the owner clicks the emailed link (or requests a code), enters it,
// and Kratos hands off to /settings to set the first password (UC-AUTH-01 / UC-AUTH-06).
export const Route = createFileRoute('/recovery')({
  validateSearch: (s: Record<string, unknown>) => ({
    flow: typeof s.flow === 'string' ? s.flow : undefined,
  }),
  component: RecoveryPage,
})

function RecoveryPage() {
  const { flow: flowId } = Route.useSearch()
  const { flow, submitting, error, onSubmit } = useKratosFlow('recovery', { flowId })

  return (
    <AuthShell
      title="Recover access"
      subtitle="We'll email you a one-time code"
      footer={
        <Link to="/login" className="underline">
          Back to sign in
        </Link>
      }
    >
      {error && <p className="mb-3 text-sm text-destructive">{error}</p>}
      {flow ? (
        <KratosForm flow={flow} onSubmit={onSubmit} submitting={submitting} groups={['code', 'link']} />
      ) : (
        <p className="text-sm text-muted-foreground">Loading…</p>
      )}
    </AuthShell>
  )
}
