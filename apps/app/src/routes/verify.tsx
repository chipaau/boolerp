import { createFileRoute, Link } from '@tanstack/react-router'
import { AuthShell } from '@/components/auth-shell'
import { KratosForm } from '@/components/kratos-form'
import { useKratosFlow } from '@/lib/use-flow'

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
      title="Verify email"
      subtitle="Enter the code we emailed you"
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
