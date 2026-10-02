import { signIn } from '@workspace/session'

// Hand-written fetch client — the OpenAPI-generated one (packages/api-client) doesn't exist yet
// anywhere in the repo (apps/app is still mock-data only too). Same-origin: Traefik already routes
// admin.bool.test/api/* to the Go API, so a relative path + the browser's own cookie handling is
// all this needs — no base URL, no manual credential wiring.
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  // No usable session (bff-admin answers 401): sign in again and come back here.
  if (res.status === 401) return signIn()
  if (!res.ok) {
    const body: unknown = await res.json().catch(() => null)
    const obj = body && typeof body === 'object' ? (body as Record<string, unknown>) : null
    const message = obj && 'error' in obj ? String(obj.error) : `Request failed (${res.status})`
    // A 422 carries an `errors` map of field -> messages (see internal/respond.Invalid). Surface
    // those instead of the bare "validation failed", which says nothing the operator can act on.
    const fields = obj?.errors
    if (fields && typeof fields === 'object') {
      const detail = Object.entries(fields as Record<string, string[]>)
        .map(([field, msgs]) => `${field} ${msgs.join(', ')}`)
        .join('; ')
      if (detail) throw new Error(`${message}: ${detail}`)
    }
    throw new Error(message)
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
}
