import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // compile the shared TS/TSX UI package
  transpilePackages: ['@workspace/ui'],
  // allow dev asset requests when served behind Traefik at *.bool.test
  allowedDevOrigins: ['website.bool.test', 'bool.test'],
}

export default nextConfig
