import 'server-only'
import { Configuration, OAuth2Api, ResponseError } from '@ory/client-fetch'

/**
 * Hydra's admin API (C87, C89), reachable only on the internal network and used
 * by the consent and logout routes. Never call it from the browser.
 */
export function hydraAdmin(): OAuth2Api {
  const url = process.env.HYDRA_ADMIN_URL
  if (!url) throw new Error('HYDRA_ADMIN_URL is not set')
  return new OAuth2Api(new Configuration({ basePath: url.replace(/\/$/, '') }))
}

/**
 * Where to send the browser when Hydra no longer has a challenge, or null for any other
 * error. A challenge that was already handled (410, a double-clicked button or a reload)
 * continues where Hydra says; an unknown or expired one (404) goes to the login service's
 * home, which leads on to the account or login page. Either way the person sees a page,
 * not a 500.
 */
export async function goneChallengeRedirect(err: unknown, home: string): Promise<string | null> {
  if (!(err instanceof ResponseError)) return null
  const status = err.response.status
  if (status === 410) {
    const body = (await err.response.json().catch(() => ({}))) as { redirect_to?: unknown }
    return typeof body.redirect_to === 'string' && body.redirect_to ? body.redirect_to : home
  }
  if (status === 404) return home
  return null
}
