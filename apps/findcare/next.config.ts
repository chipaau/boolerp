import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // compile the shared TS/TSX UI package
  transpilePackages: ['@workspace/ui'],
  // allow dev asset requests when served behind Traefik. FindCare has its own domain rather than a
  // host under bool.test: it is a separate product with its own public side, like cyryx.test on the
  // same development proxy.
  allowedDevOrigins: ['findcare.test', 'www.findcare.test'],
}

export default nextConfig
