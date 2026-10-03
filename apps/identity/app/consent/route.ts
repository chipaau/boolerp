import { NextResponse, type NextRequest } from 'next/server'
import { goneChallengeRedirect, hydraAdmin } from '@/lib/hydra'
import { publicUrl } from '@/lib/kratos'

// Hydra's consent step (C87, C89). Kratos handles only Hydra's login step, so this
// route answers the consent step through Hydra's admin API. First-party clients
// (skip_consent) are approved at once with what they asked for; anyone else is
// refused with access_denied, since there is no consent screen yet.
export async function GET(request: NextRequest) {
  const challenge = request.nextUrl.searchParams.get('consent_challenge')
  if (!challenge) return new NextResponse('Missing consent_challenge.', { status: 400 })

  try {
    return await consent(challenge)
  } catch (err) {
    // A consent challenge that was already used or has expired (a reload or the back
    // button) continues where Hydra says, or goes home, instead of failing with a 500.
    const to = await goneChallengeRedirect(err, new URL('/', publicUrl()).toString())
    if (to) return NextResponse.redirect(to, 303)
    throw err
  }
}

async function consent(challenge: string): Promise<NextResponse> {
  const hydra = hydraAdmin()
  const consent = await hydra.getOAuth2ConsentRequest({ consentChallenge: challenge })

  if (!consent.client?.skip_consent) {
    const rejected = await hydra.rejectOAuth2ConsentRequest({
      consentChallenge: challenge,
      rejectOAuth2Request: {
        error: 'access_denied',
        error_description: 'This application is not allowed to sign in with Bool.',
      },
    })
    return NextResponse.redirect(rejected.redirect_to)
  }

  const accepted = await hydra.acceptOAuth2ConsentRequest({
    consentChallenge: challenge,
    acceptOAuth2ConsentRequest: {
      grant_scope: consent.requested_scope,
      grant_access_token_audience: consent.requested_access_token_audience,
      // Nothing is asked of the user, so there is nothing to remember.
      remember: false,
    },
  })
  return NextResponse.redirect(accepted.redirect_to)
}
