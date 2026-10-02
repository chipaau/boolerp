import { NextResponse, type NextRequest } from 'next/server'

// The login service's Content-Security-Policy (C111), as the Next.js guide sets it: a fresh
// nonce per page, which Next.js puts on its own scripts and the layout on the theme script
// (x-nonce). Styles stay 'unsafe-inline' as in the apps' policy (the shared UI sets style
// attributes); Google Fonts are allowed until Lato is self-hosted. form-action is not set:
// the login form's redirects go on through Hydra to every app domain, and browsers apply
// form-action to those too. Development needs 'unsafe-eval' (React's error stacks).
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  const dev = process.env.NODE_ENV === 'development'
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' blob: data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
  ].join('; ')

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', csp)
  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set('Content-Security-Policy', csp)
  return response
}

export const config = {
  matcher: [
    {
      // Pages only: not static files, and not prefetches.
      source: '/((?!_next/static|_next/image|favicon.png).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
}
