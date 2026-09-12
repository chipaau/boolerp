// Hand-written fetch client — the OpenAPI-generated one (packages/api-client) doesn't exist yet
// anywhere in the repo (apps/app is still mock-data only too). Same-origin: Traefik already routes
// admin.bool.test/api/* to the Go API, so a relative path + the browser's own cookie handling is
// all this needs — no base URL, no manual credential wiring.
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  if (!res.ok) {
    const body: unknown = await res.json().catch(() => null)
    const message = body && typeof body === 'object' && 'error' in body ? String((body as { error: unknown }).error) : `Request failed (${res.status})`
    throw new Error(message)
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
}
