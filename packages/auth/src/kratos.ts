// Minimal typed client for Ory Kratos browser self-service flows, served same-origin under /auth
// (Traefik routes <tenant>.bool.test/auth/* → Kratos public). We render flow.ui.nodes generically,
// so this speaks the stable flow-JSON contract directly rather than pulling the full Ory SDK.

const BASE = '/auth'
const JSON_HEADERS = { Accept: 'application/json' } as const

export type FlowKind = 'login' | 'recovery' | 'settings' | 'verification'

export type UiText = {
  id: number
  text: string
  type: 'info' | 'error' | 'success'
  context?: Record<string, unknown>
}

export type UiNodeAttributes = {
  name?: string
  type?: string
  value?: unknown
  disabled?: boolean
  required?: boolean
  autocomplete?: string
  /** WebAuthn / passkey trigger buttons carry the JS Kratos wants run on click. */
  onclick?: string
  /** Script nodes (the WebAuthn helper) point at the script to load. */
  src?: string
  async?: boolean
  crossorigin?: string
  integrity?: string
  referrerpolicy?: string
  nonce?: string
  id?: string
  node_type: string
}

export type UiNode = {
  type: 'input' | 'text' | 'img' | 'a' | 'script'
  group: string // default | password | code | link | oidc | totp | webauthn | profile
  attributes: UiNodeAttributes
  messages: UiText[]
  meta: { label?: UiText }
}

export type UiContainer = {
  action: string
  method: string
  nodes: UiNode[]
  messages?: UiText[]
}

export type ContinueWith = {
  action: string // redirect_browser_to | show_settings_ui | show_verification_ui | ...
  redirect_browser_to?: string
  flow?: { id: string }
}

export type Flow = {
  id: string
  type?: string
  state?: string // e.g. choose_method | sent_email | passed_challenge | success
  ui: UiContainer
  return_to?: string
  continue_with?: ContinueWith[]
}

export type Session = {
  id: string
  active: boolean
  identity: { id: string; traits: Record<string, unknown> }
}

// FlowError carries the HTTP status so callers can distinguish expired (410) / gone flows.
export class FlowError extends Error {
  constructor(
    public status: number,
    public redirectTo?: string,
  ) {
    super(`kratos flow error: ${status}`)
  }
}

// SubmitResult: terminal success (session, if any); the same flow re-rendered (validation error OR
// the next step in the same screen, e.g. recovery email→code); a full-page redirect; or a hand-off
// to another flow's UI (e.g. recovery → settings) that we open by navigating with its flow id.
export type SubmitResult =
  | { kind: 'success'; session?: Session }
  | { kind: 'flow'; flow: Flow }
  | { kind: 'redirect'; to: string }
  | { kind: 'handoff'; kind_of: FlowKind; flowId: string }

/** createFlow initializes a new browser flow and returns its JSON (Accept: application/json). */
export async function createFlow(kind: FlowKind, query?: string): Promise<Flow> {
  const res = await fetch(`${BASE}/self-service/${kind}/browser${query ? `?${query}` : ''}`, {
    headers: JSON_HEADERS,
    credentials: 'include',
  })
  if (!res.ok) throw new FlowError(res.status)
  return res.json()
}

/** getFlow fetches an existing flow by id (e.g. from the ?flow= param on a redirect/email link). */
export async function getFlow(kind: FlowKind, id: string): Promise<Flow> {
  const res = await fetch(`${BASE}/self-service/${kind}/flows?id=${encodeURIComponent(id)}`, {
    headers: JSON_HEADERS,
    credentials: 'include',
  })
  if (!res.ok) throw new FlowError(res.status)
  return res.json()
}

/** submit posts a flow to its ui.action. 200 = success, 400 = re-render with messages, 422 = redirect. */
export async function submit(flow: Flow, body: Record<string, string>): Promise<SubmitResult> {
  const res = await fetch(sameOrigin(flow.ui.action), {
    method: (flow.ui.method || 'POST').toUpperCase(),
    headers: { ...JSON_HEADERS, 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  })

  const data = await res.json().catch(() => null)

  if (res.status === 400) {
    // Validation / credential errors — Kratos returns the flow with ui.messages populated.
    return { kind: 'flow', flow: data }
  }
  if (res.status === 422) {
    return { kind: 'redirect', to: data?.redirect_browser_to ?? '/' }
  }
  if (res.ok) {
    // continue_with directives drive multi-flow outcomes (e.g. recovery → settings).
    const cw: ContinueWith[] = Array.isArray(data?.continue_with) ? data.continue_with : []
    const settings = cw.find((c) => c.action === 'show_settings_ui')
    if (settings?.flow?.id) return { kind: 'handoff', kind_of: 'settings', flowId: settings.flow.id }
    const verify = cw.find((c) => c.action === 'show_verification_ui')
    if (verify?.flow?.id) return { kind: 'handoff', kind_of: 'verification', flowId: verify.flow.id }
    const redir = cw.find((c) => c.action === 'redirect_browser_to')
    if (redir?.redirect_browser_to) return { kind: 'redirect', to: redir.redirect_browser_to }
    // A continued flow that still needs input in THIS screen (e.g. recovery sent_email → enter code).
    if (data?.ui && data.state && data.state !== 'success' && data.state !== 'passed_challenge') {
      return { kind: 'flow', flow: data }
    }
    return { kind: 'success', session: data?.session }
  }
  // 410 (expired) and everything else: surface for a fresh flow.
  const redirectTo: string | undefined = data?.error?.details?.redirect_to
  throw new FlowError(res.status, redirectTo)
}

/**
 * Session state for guards. Kratos is configured with `whoami.required_aal: highest_available`, so a
 * user who has enrolled a second factor but only completed the first gets 403 `session_aal2_required`
 * — the guard must send them to /login?aal=aal2 rather than treat them as signed out.
 */
export type SessionState = { status: 'active'; session: Session } | { status: 'aal2_required' } | { status: 'none' }

export async function getSession(): Promise<SessionState> {
  const res = await fetch(`${BASE}/sessions/whoami`, { headers: JSON_HEADERS, credentials: 'include' })
  if (res.status === 200) return { status: 'active', session: await res.json() }
  if (res.status === 403) {
    const body = await res.json().catch(() => null)
    if (body?.error?.id === 'session_aal2_required') return { status: 'aal2_required' }
  }
  return { status: 'none' }
}

/** whoami returns the fully authenticated session or null. */
export async function whoami(): Promise<Session | null> {
  const s = await getSession()
  return s.status === 'active' ? s.session : null
}

/**
 * sameOrigin rewrites a Kratos-generated absolute URL onto the current origin. Kratos builds URLs
 * from its single configured base_url (one tenant host in dev); we serve /auth same-origin on every
 * subdomain via the proxy, so flows, scripts and logout must hit the host the user is actually on.
 */
export function sameOrigin(url: string): string {
  const u = new URL(url, window.location.origin)
  u.protocol = window.location.protocol
  u.host = window.location.host
  return u.toString()
}

/**
 * safeReturnTo accepts only an in-app path: it must start with a single "/" (a second slash or a
 * backslash would be a protocol-relative redirect to another host). Anything else → fallback.
 */
export function safeReturnTo(raw: unknown, fallback = '/'): string {
  return typeof raw === 'string' && /^\/(?![\/\\])/.test(raw) ? raw : fallback
}

/** createLogoutFlow fetches a self-service logout token+URL for the current session. */
export async function createLogoutFlow(): Promise<{ logout_url: string } | null> {
  const res = await fetch(`${BASE}/self-service/logout/browser`, { headers: JSON_HEADERS, credentials: 'include' })
  if (!res.ok) return null
  return res.json()
}

/**
 * logout ends the current session (UC-AUTH-09) and lands on this origin's /login. The logout URL is
 * rewritten onto the current host and told where to return, so signing out of admin.bool.test or any
 * tenant subdomain never bounces through the base_url host.
 */
export async function logout(returnPath = '/login'): Promise<void> {
  const flow = await createLogoutFlow()
  if (!flow?.logout_url) {
    window.location.href = returnPath
    return
  }
  const url = new URL(sameOrigin(flow.logout_url))
  url.searchParams.set('return_to', window.location.origin + returnPath)
  window.location.href = url.toString()
}

// ---- node helpers -------------------------------------------------------------------------------

/** initialValues seeds a form's state from the flow's current node values (incl. csrf_token). */
export function initialValues(flow: Flow): Record<string, string> {
  const values: Record<string, string> = {}
  for (const node of flow.ui.nodes) {
    const { name, value, type } = node.attributes
    if (node.type === 'input' && name && type !== 'submit' && type !== 'button' && value != null) {
      values[name] = String(value)
    }
  }
  return values
}

/** label returns a node's human label (meta.label) or a sensible fallback. */
export function nodeLabel(node: UiNode): string {
  return node.meta?.label?.text ?? node.attributes.name ?? ''
}
