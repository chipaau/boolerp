import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // compile the shared TS/TSX packages
  transpilePackages: ['@workspace/ui', '@workspace/assets'],
  // allow dev asset requests when served behind Traefik
  allowedDevOrigins: ['identity.bool.test'],
}

export default nextConfig
