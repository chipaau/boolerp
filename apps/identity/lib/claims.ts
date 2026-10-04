import 'server-only'
import { Configuration, IdentityApi, type Identity } from '@ory/client-fetch'

/**
 * Kratos's admin API, reachable only on the internal network and used by the consent
 * route alone, to read the account it is consenting for. Never call it from the browser.
 */
function identityAdmin(): IdentityApi {
  const url = process.env.KRATOS_ADMIN_URL
  if (!url) throw new Error('KRATOS_ADMIN_URL is not set')
  return new IdentityApi(new Configuration({ basePath: url.replace(/\/$/, '') }))
}

/** The OpenID Connect standard claims (Core 1.0, 5.1) a client may receive. */
export type IdTokenClaims = {
  email?: string
  email_verified?: boolean
  phone_number?: string
  name?: string
  picture?: string
}

/**
 * The ID token claims for the account `subject`, limited to the granted scopes: `email`
 * gives email and email_verified, `phone` the phone number, `profile` the name and
 * picture (only those the account has). Hydra puts them in the ID token and returns them
 * from /userinfo, never in the access token.
 */
export async function idTokenClaims(subject: string, scopes: string[]): Promise<IdTokenClaims> {
  if (!scopes.some((s) => s === 'email' || s === 'phone' || s === 'profile')) return {}
  const identity = await identityAdmin().getIdentity({ id: subject })
  return claimsFor(identity, scopes)
}

function claimsFor(identity: Identity, scopes: string[]): IdTokenClaims {
  const traits = (identity.traits ?? {}) as Record<string, unknown>
  const text = (key: string) => (typeof traits[key] === 'string' && traits[key] ? (traits[key] as string) : undefined)
  const claims: IdTokenClaims = {}

  const email = text('email')
  if (scopes.includes('email') && email) {
    claims.email = email
    claims.email_verified = (identity.verifiable_addresses ?? []).some(
      (a) => a.via === 'email' && a.value.toLowerCase() === email.toLowerCase() && a.verified
    )
  }
  // The phone is a contact number Kratos does not verify (C85), so no phone_number_verified.
  const phone = text('phone')
  if (scopes.includes('phone') && phone) claims.phone_number = phone
  if (scopes.includes('profile')) {
    const name = text('name')
    const picture = text('picture')
    if (name) claims.name = name
    if (picture) claims.picture = picture
  }
  return claims
}
