import { NextResponse, type NextRequest } from 'next/server'
import { Configuration, FrontendApi, ResponseError } from '@ory/client-fetch'
import { goneChallengeRedirect, hydraAdmin } from '@/lib/hydra'
import { publicUrl } from '@/lib/kratos'

// Hydra's logout step (C101). An app's BFF sends the browser to Hydra's logout with the
// person's ID token as id_token_hint; Hydra checks that it belongs to the browser's login and
// sends the browser here with a logout_challenge marked rp_initiated. That logout proceeds at
// once. Any other logout (a plain link to Hydra's logout, which any site can make) is asked
// about first, so another site cannot sign people out: the confirmation page posts back here.
//
// Addresses are built from IDENTITY_PUBLIC_URL, not request.nextUrl, whose origin is the
// address the server listens on (http://0.0.0.0:3000), not the one the browser used.

export async function GET(request: NextRequest) {
  const challenge = request.nextUrl.searchParams.get('logout_challenge')
  if (!challenge) return new NextResponse('Missing logout_challenge.', { status: 400 })

  return orGone(async () => {
    const logout = await hydraAdmin().getOAuth2LogoutRequest({ logoutChallenge: challenge })
    if (!logout.rp_initiated) {
      const confirm = new URL('/logout/confirm', publicUrl())
      confirm.search = new URLSearchParams({ logout_challenge: challenge }).toString()
      return NextResponse.redirect(confirm, 303)
    }
    return endLogin(request, challenge)
  })
}

// The confirmation page's answer: sign out, or stay signed in.
export async function POST(request: NextRequest) {
  if (!fromThisSite(request)) return new NextResponse('Forbidden.', { status: 403 })
  const form = await request.formData()
  const challenge = form.get('logout_challenge')
  if (typeof challenge !== 'string' || !challenge) {
    return new NextResponse('Missing logout_challenge.', { status: 400 })
  }
  return orGone(async () => {
    if (form.get('action') !== 'logout') {
      await hydraAdmin().rejectOAuth2LogoutRequest({ logoutChallenge: challenge })
      return NextResponse.redirect(new URL('/', publicUrl()), 303)
    }
    return endLogin(request, challenge)
  })
}

/**
 * Runs a logout step; a challenge Hydra no longer has (used, expired, or unknown) sends
 * the browser on instead of failing with a 500.
 */
async function orGone(step: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    return await step()
  } catch (err) {
    const to = await goneChallengeRedirect(err, new URL('/', publicUrl()).toString())
    if (to) return NextResponse.redirect(to, 303)
    throw err
  }
}

/**
 * Whether the request came from a page of this site. Next.js checks this for Server
 * Actions only, and a Server Action cannot pass on Kratos's cookie-clearing headers, so
 * this route checks it itself: Sec-Fetch-Site, sent by every current browser, or the
 * Origin header as a fallback.
 */
function fromThisSite(request: NextRequest): boolean {
  const site = request.headers.get('sec-fetch-site')
  if (site) return site === 'same-origin'
  return request.headers.get('origin') === new URL(publicUrl()).origin
}

/**
 * Ends the browser's Kratos session (passing on Kratos's cookie-clearing headers), then
 * accepts Hydra's logout request, which ends Hydra's login session, notifies the other apps
 * of that login (back-channel logout), and returns the browser to the app.
 */
async function endLogin(request: NextRequest, challenge: string): Promise<NextResponse> {
  const kratosUrl = process.env.KRATOS_INTERNAL_URL
  if (!kratosUrl) throw new Error('KRATOS_INTERNAL_URL is not set')
  const kratos = new FrontendApi(
    new Configuration({
      basePath: kratosUrl.replace(/\/$/, ''),
      // The browser's cookies identify its Kratos session; JSON answers instead of redirects.
      headers: { cookie: request.headers.get('cookie') ?? '', accept: 'application/json' },
    }),
  )

  const cleared: string[] = []
  try {
    const flow = await kratos.createBrowserLogoutFlow()
    const res = await kratos.updateLogoutFlowRaw({ token: flow.logout_token })
    cleared.push(...res.raw.headers.getSetCookie())
  } catch (err) {
    // 401: the browser has no Kratos session (already signed out); nothing to end.
    if (!(err instanceof ResponseError && err.response.status === 401)) throw err
  }

  const accepted = await hydraAdmin().acceptOAuth2LogoutRequest({ logoutChallenge: challenge })
  const response = NextResponse.redirect(accepted.redirect_to, 303)
  for (const cookie of cleared) response.headers.append('set-cookie', cookie)
  return response
}
