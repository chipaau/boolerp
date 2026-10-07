import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // compile the shared TS/TSX UI package
  transpilePackages: ['@workspace/ui'],
  // Dev asset requests arrive on a tenant's own host, not a Bool one: a portal is always on the
  // customer's verified domain (C191), so these are the seeded sample tenant's hosts.
  allowedDevOrigins: ['portal.cyryx.test', 'lecturer.cyryx.test'],
}

export default nextConfig
