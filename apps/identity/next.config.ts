import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // compile the shared TS/TSX packages
  transpilePackages: ['@workspace/ui', '@workspace/assets'],
  // allow dev asset requests when served behind Traefik
  allowedDevOrigins: ['identity.bool.test'],
  // Headers for every response, files included; the Content-Security-Policy is set per page
  // in proxy.ts (C111).
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
        ],
      },
    ]
  },
}

export default nextConfig
