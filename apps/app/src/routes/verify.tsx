import { createFileRoute, Link } from '@tanstack/react-router'
import { AuthShell, KratosForm, useKratosFlow } from '@workspace/auth'

// Email verification (UC-AUTH-07). Kratos emails a code; the generic form renders it.
export const Route = createFileRoute('/verify')({
  validateSearch: (s: Record<string, unknown>) => ({
    flow: typeof s.flow === 'string' ? s.flow : undefined,
  }),
  component: VerifyPage,
})

function VerifyPage() {
  const { flow: flowId } = Route.useSearch()
  const { flow, submitting, error, onSubmit } = useKratosFlow('verification', { flowId })

  return (
    <AuthShell
      title="Check your inbox"
      subtitle="Enter the six-digit code we emailed you."
      footer={
        <Link
          to="/login"
          search={{ flow: undefined, return_to: undefined }}
          className="text-link hover:underline hover:underline-offset-[3px]"
        >
          Back to sign in
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
