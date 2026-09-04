import { createFileRoute, Link } from '@tanstack/react-router'
import { AuthShell, KratosForm, useKratosFlow } from '@workspace/auth'

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
      subtitle="We'll email you a one-time code, good for ten minutes."
      footer={
        <Link
          to="/login"
          search={{ flow: undefined, return_to: undefined }}
          className="text-link hover:underline hover:underline-offset-[3px]"
        >
          Use a password instead
        </Link>
      }
    >
      {error && (
        <p role="alert" className="mb-3 rounded-full bg-destructive-soft px-[18px] py-3 text-ui-sm text-destructive">
          {error}
        </p>
      )}
      {flow ? (
        <KratosForm flow={flow} onSubmit={onSubmit} submitting={submitting} groups={['code', 'link']} />
      ) : (
        <p className="text-ui-lg text-muted-foreground">Loading…</p>
      )}
    </AuthShell>
  )
}
