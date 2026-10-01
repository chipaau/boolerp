import {
  Configuration,
  FrontendApi,
  ResponseError,
  type LoginFlow,
  type RecoveryFlow,
  type RegistrationFlow,
  type SettingsFlow,
  type VerificationFlow,
} from '@ory/client-fetch'
import type { OryClientConfiguration } from '@ory/elements-react'

// Kratos's public API is on this same host under /kratos (Traefik strips the prefix,
// C85), so its cookies are first-party and every request carries them.
export const kratosUrl = `${window.location.origin}/kratos`

export const frontend = new FrontendApi(new Configuration({ basePath: kratosUrl, credentials: 'include' }))

const ui = (path: string) => `${window.location.origin}${path}`

// Elements' view of this deployment: where each page lives and what is enabled
// (C85: open registration, recovery and verification by code).
export const oryConfig: OryClientConfiguration = {
  sdk: { url: kratosUrl },
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
}

export type FlowKind = 'login' | 'registration' | 'recovery' | 'verification' | 'settings'

/**
 * Sends the browser to Kratos to start a new flow. Kratos sets its CSRF cookie and
 * redirects back to this app's page with ?flow=<id>. return_to is passed through;
 * Kratos accepts it only if it is in selfservice.allowed_return_urls.
 */
export function startFlow(kind: FlowKind, returnTo?: string): Promise<never> {
  const qs = returnTo ? `?return_to=${encodeURIComponent(returnTo)}` : ''
  window.location.assign(`${kratosUrl}/self-service/${kind}/browser${qs}`)
  return new Promise(() => {}) // the page is leaving
}

export type Flows = {
  login: LoginFlow
  registration: RegistrationFlow
  recovery: RecoveryFlow
  verification: VerificationFlow
  settings: SettingsFlow
}

const getters: { [K in FlowKind]: (id: string) => Promise<Flows[K]> } = {
  login: (id) => frontend.getLoginFlow({ id }),
  registration: (id) => frontend.getRegistrationFlow({ id }),
  recovery: (id) => frontend.getRecoveryFlow({ id }),
  verification: (id) => frontend.getVerificationFlow({ id }),
  settings: (id) => frontend.getSettingsFlow({ id }),
}

/**
 * Loads the flow named in the URL, or starts one. An expired, unknown, or foreign
 * flow (403, 404, 410) is replaced by a new one; settings without a session goes to
 * login first (401) and comes back.
 */
export async function loadFlow<K extends FlowKind>(kind: K, flowId?: string, returnTo?: string): Promise<Flows[K]> {
  if (!flowId) return startFlow(kind, returnTo)
  try {
    return await getters[kind](flowId)
  } catch (err) {
    if (err instanceof ResponseError) {
      const status = err.response.status
      if (status === 401) return startFlow('login', window.location.href)
      if (status === 403 || status === 404 || status === 410) return startFlow(kind, returnTo)
    }
    throw err
  }
}
