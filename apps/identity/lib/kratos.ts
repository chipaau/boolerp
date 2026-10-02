import 'server-only'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import {
  Configuration,
  FrontendApi,
  ResponseError,
  type FlowError,
  type LoginFlow,
  type RecoveryFlow,
  type RegistrationFlow,
  type SettingsFlow,
  type VerificationFlow,
} from '@ory/client-fetch'
import type { OryClientConfiguration } from '@ory/elements-react'

// The address browsers use (Kratos is under /kratos on the same host, C85), and the
// one this server uses inside Compose. Both come from the environment, read per
// request so that building the app needs neither.
export const publicUrl = () => required('IDENTITY_PUBLIC_URL')
const kratosPublicUrl = () => `${publicUrl()}/kratos`

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not set`)
  return value.replace(/\/$/, '')
}

/** Kratos's public API, called from this server with the browser's cookies. */
async function frontend(): Promise<FrontendApi> {
  // The browser's Cookie header as sent: Kratos checks its CSRF cookie on browser flows.
  const cookie = (await headers()).get('cookie') ?? ''
  return new FrontendApi(new Configuration({ basePath: required('KRATOS_INTERNAL_URL'), headers: { cookie } }))
}

const ui = (path: string) => `${publicUrl()}${path}`

/** Elements' view of this deployment (C85: open registration, recovery and verification by code). */
export const oryConfig = (): OryClientConfiguration => ({
  sdk: { url: kratosPublicUrl() },
  project: {
    name: 'Bool',
    default_redirect_url: ui('/'),
    error_ui_url: ui('/error'),
    login_ui_url: ui('/login'),
    registration_ui_url: ui('/registration'),
    recovery_ui_url: ui('/recovery'),
    verification_ui_url: ui('/verification'),
    settings_ui_url: ui('/settings'),
    registration_enabled: true,
    recovery_enabled: true,
    verification_enabled: true,
    hide_ory_branding: true,
  },
})

export type Flows = {
  login: LoginFlow
  registration: RegistrationFlow
  recovery: RecoveryFlow
  verification: VerificationFlow
  settings: SettingsFlow
}
export type FlowKind = keyof Flows

/**
 * Sends the browser to Kratos to start a flow; Kratos comes back with ?flow=<id>.
 * Hydra's login_challenge (login and registration started by an OAuth2 client) is
 * passed on, so Kratos completes Hydra's login step afterwards (C89).
 */
function startFlow(kind: FlowKind, returnTo?: string, loginChallenge?: string): never {
  const params = new URLSearchParams()
  if (returnTo) params.set('return_to', returnTo)
  if (loginChallenge) params.set('login_challenge', loginChallenge)
  const qs = params.size ? `?${params}` : ''
  redirect(`${kratosPublicUrl()}/self-service/${kind}/browser${qs}`)
}

/**
 * Loads the flow named in the URL, or starts one. An expired, unknown, or foreign
 * flow (403, 404, 410) is replaced; settings without a session goes to login (401)
 * and comes back. Other failures propagate to the error boundary.
 */
export async function loadFlow<K extends FlowKind>(
  kind: K,
  flowId?: string,
  returnTo?: string,
  loginChallenge?: string
): Promise<Flows[K]> {
  if (!flowId) startFlow(kind, returnTo, loginChallenge)
  const api = await frontend()
  const get: { [P in FlowKind]: (id: string) => Promise<Flows[P]> } = {
    login: (id) => api.getLoginFlow({ id }),
    registration: (id) => api.getRegistrationFlow({ id }),
    recovery: (id) => api.getRecoveryFlow({ id }),
    verification: (id) => api.getVerificationFlow({ id }),
    settings: (id) => api.getSettingsFlow({ id }),
  }
  try {
    return await get[kind](flowId)
  } catch (err) {
    if (err instanceof ResponseError) {
      const status = err.response.status
      if (status === 401) startFlow('login', ui(`/${kind}`))
      if (status === 403 || status === 404 || status === 410) startFlow(kind, returnTo, loginChallenge)
    }
    throw err
  }
}

/** The error Kratos sent the browser here with (?id=). */
export async function loadFlowError(id: string): Promise<FlowError> {
  return (await frontend()).getFlowError({ id })
}

/** Kratos's logout link carries a one-time token, so it is fetched, not built. */
export async function logoutUrl(): Promise<string | undefined> {
  try {
    return (await (await frontend()).createBrowserLogoutFlow()).logout_url
  } catch {
    return undefined
  }
}

export type FlowSearch = Promise<{ flow?: string; return_to?: string; login_challenge?: string }>
