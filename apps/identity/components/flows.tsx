'use client'

// Ory Elements' flow screens drawn with the Bool design (C86). Client components:
// the server pages load each flow from Kratos and pass it here.
import type {
  FlowError,
  LoginFlow,
  RecoveryFlow,
  RegistrationFlow,
  SettingsFlow,
  VerificationFlow,
} from '@ory/client-fetch'
import type { OryClientConfiguration } from '@ory/elements-react'
import { Error as OryError, Login, Recovery, Registration, Settings, Verification } from '@ory/elements-react/theme'
import { AccountShell, boolComponents } from '@/theme/bool'

type Props<F> = { flow: F; config: OryClientConfiguration }

export function LoginView({ flow, config }: Props<LoginFlow>) {
  return <Login flow={flow} config={config} components={boolComponents} />
}

export function RegistrationView({ flow, config }: Props<RegistrationFlow>) {
  return <Registration flow={flow} config={config} components={boolComponents} />
}

export function RecoveryView({ flow, config }: Props<RecoveryFlow>) {
  return <Recovery flow={flow} config={config} components={boolComponents} />
}

export function VerificationView({ flow, config }: Props<VerificationFlow>) {
  return <Verification flow={flow} config={config} components={boolComponents} />
}

export function SettingsView({ flow, config, logoutUrl }: Props<SettingsFlow> & { logoutUrl?: string }) {
  return (
    <AccountShell logoutUrl={logoutUrl}>
      <Settings flow={flow} config={config} components={boolComponents} />
    </AccountShell>
  )
}

export function ErrorView({ error, config }: { error: FlowError; config: OryClientConfiguration }) {
  return <OryError error={error} config={config} components={boolComponents} />
}
