// Sign-in through the app's backend-for-frontend (docs/platform/bff-frontend.md, C96, C98): the
// BFF keeps the session in an HttpOnly cookie and adds the access token to /api calls, so the
// app never handles tokens or talks to Kratos or Hydra itself.

/** The signed-in person, from GET /api/auth/me. */
export type Me = { id: string; email: string; phone: string; displayName?: string }

/** Sends the browser to the BFF's sign-in, returning to `returnTo` (a path on this site). */
export function signIn(returnTo: string = window.location.pathname + window.location.search): Promise<never> {
  const path = returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/'
  window.location.assign(`/auth/login?return_to=${encodeURIComponent(path)}`)
  // The page is being replaced; nothing after this should run.
  return new Promise<never>(() => {})
}

/** The signed-in person, or null without a session (the BFF answers 401). */
export async function currentUser(): Promise<Me | null> {
  const res = await fetch('/api/auth/me', { headers: { Accept: 'application/json' } })
  if (res.status === 401) return null
  if (!res.ok) throw new Error(`Could not load the signed-in user (${res.status})`)
  const body = (await res.json()) as { user: Me | null }
  return body.user
}
