import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

// Sign-in through the app's backend-for-frontend (docs/platform/bff-frontend.md, C96, C98): the
// BFF keeps the session in an HttpOnly cookie and adds the access token to /api calls, so the
// app never handles tokens or talks to Kratos or Hydra itself.

/** The signed-in person, from GET /api/auth/me. `avatarUrl` is their picture, the same in every app. */
export type Me = { id: string; email: string; phone: string; displayName?: string; avatarUrl?: string }

/** A built-in picture a person may choose (C196). */
export type Portrait = { id: string; url: string }

/** Sends the browser to the BFF's sign-in, returning to `returnTo` (a path on this site). */
export function signIn(returnTo: string = window.location.pathname + window.location.search): Promise<never> {
  // The BFF checks it again; parsing it as the browser would keeps only a path on this site.
  const url = URL.parse(returnTo, window.location.origin)
  const path = url?.origin === window.location.origin ? url.pathname + url.search + url.hash : '/'
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

/** The pictures a person may choose, from GET /api/auth/me/portraits. */
export async function portraits(): Promise<Portrait[]> {
  const res = await fetch('/api/auth/me/portraits', { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`Could not load the portraits (${res.status})`)
  return ((await res.json()) as { portraits: Portrait[] }).portraits
}

/**
 * Makes one of the portraits the signed-in person's picture, or `''` for their initials
 * (PUT /api/auth/me/photo). It is saved on their account, so every app they sign in to shows it.
 */
export async function setPortrait(portrait: string): Promise<Me> {
  const res = await fetch('/api/auth/me/photo', {
    method: 'PUT',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ portrait }),
  })
  if (!res.ok) throw new Error(`Could not save your photo (${res.status})`)
  return ((await res.json()) as { user: Me }).user
}

/**
 * The signed-in person as a query, which both apps read: the layout's loader with
 * `ensureQueryData`, the chrome with `useQuery`. It is checked again every time the tab regains
 * focus ('always', however fresh), so a change made in another app (a new photo, C196) shows on
 * coming back to this one; the staleTime only stops the layout refetching what its loader has just
 * fetched.
 */
export const meQuery = () =>
  queryOptions({ queryKey: ['session', 'me'], queryFn: currentUser, staleTime: 30_000, refetchOnWindowFocus: 'always' })

/** The pictures a person may choose, loaded once the photo dialog first opens. */
export function usePortraits(enabled: boolean): Portrait[] {
  return useQuery({ queryKey: ['session', 'portraits'], queryFn: portraits, enabled, staleTime: Infinity }).data ?? []
}

/** Saves the signed-in person's photo; the answer replaces the cached person, so it shows at once. */
export function useSetPortrait() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: setPortrait,
    onSuccess: (me) => qc.setQueryData(meQuery().queryKey, me),
  })
}

/**
 * Signs out everywhere (C101): a form POST to the BFF, which ends the session and sends the
 * browser through Hydra's logout (ending the login service's session too) and back here.
 */
export function signOut(): void {
  const form = document.createElement('form')
  form.method = 'POST'
  form.action = '/auth/logout'
  document.body.appendChild(form)
  form.submit()
}
