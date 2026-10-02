import { NextResponse, type NextRequest } from 'next/server'
import { Configuration, FrontendApi, ResponseError } from '@ory/client-fetch'
import { hydraAdmin } from '@/lib/hydra'

// Hydra's logout step (C101). An app's BFF sends the browser to Hydra's logout; Hydra
// sends it here with a logout_challenge. This route ends the browser's Kratos session
// (passing on Kratos's cookie-clearing headers), then accepts Hydra's logout request,
// which ends Hydra's login session, notifies the other apps of that login
// (back-channel logout), and returns the browser to the app.
export async function GET(request: NextRequest) {
  const challenge = request.nextUrl.searchParams.get('logout_challenge')
  if (!challenge) return new NextResponse('Missing logout_challenge.', { status: 400 })

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
