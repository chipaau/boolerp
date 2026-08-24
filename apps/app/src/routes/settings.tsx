import { useEffect } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { AuthShell } from '@workspace/auth'
import { KratosForm } from '@workspace/auth'
import { useKratosFlow } from '@workspace/auth'

// Settings set-password. Reached after recovery to finish activation (privileged session), and later
// for change-password (UC-AUTH-01 / UC-AUTH-13). Only the password group is shown in this slice.
export const Route = createFileRoute('/settings')({
  validateSearch: (s: Record<string, unknown>) => ({
    flow: typeof s.flow === 'string' ? s.flow : undefined,
  }),
  component: SettingsPage,
})

function SettingsPage() {
  const { flow: flowId } = Route.useSearch()
  const navigate = useNavigate()
  const { flow, submitting, error, onSubmit } = useKratosFlow('settings', {
    flowId,
    onSuccess: () => navigate({ to: '/' }),
  })

  // Settings updates return 200 with the flow re-rendered (a success message) rather than a
  // terminal redirect, so move on once Kratos reports success (finishes activation → the app).
  useEffect(() => {
    if (flow?.ui.messages?.some((m) => m.type === 'success')) {
      navigate({ to: '/' })
    }
  }, [flow, navigate])

  return (
    <AuthShell title="Set your password" subtitle="Choose a password to finish activation">
      {error && <p className="mb-3 text-sm text-destructive">{error}</p>}
      {flow ? (
        <KratosForm flow={flow} onSubmit={onSubmit} submitting={submitting} groups={['password']} />
      ) : (
        <p className="text-sm text-muted-foreground">Loading…</p>
      )}
    </AuthShell>
  )
}
