import 'server-only'
import { Configuration, OAuth2Api } from '@ory/client-fetch'

/**
 * Hydra's admin API (C87, C89), reachable only on the internal network and used
 * only by the consent route. Never call it from the browser.
 */
export function hydraAdmin(): OAuth2Api {
  const url = process.env.HYDRA_ADMIN_URL
  if (!url) throw new Error('HYDRA_ADMIN_URL is not set')
  return new OAuth2Api(new Configuration({ basePath: url.replace(/\/$/, '') }))
}
