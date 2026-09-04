import { useEffect } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { AuthShell, KratosForm, useKratosFlow } from '@workspace/auth'

// Credential settings (UC-AUTH-01 / UC-AUTH-13): reached after recovery to finish activation
// (privileged session) and later to change the password or manage the authenticator app, backup
// codes and passkeys. Kratos decides which groups appear; profile traits are edited elsewhere.
const CREDENTIAL_GROUPS = ['password', 'totp', 'lookup_secret', 'webauthn', 'passkey']
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
    <AuthShell title="Password & security" subtitle="Set your password. Add an authenticator app or passkey for a second factor.">
      {error && <p className="mb-3 text-sm text-destructive">{error}</p>}
      {flow ? (
        <KratosForm flow={flow} onSubmit={onSubmit} submitting={submitting} groups={CREDENTIAL_GROUPS} />
      ) : (
        <p className="text-sm text-muted-foreground">Loading…</p>
      )}
    </AuthShell>
  )
}
