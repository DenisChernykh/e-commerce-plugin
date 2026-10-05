import type { NextConfig } from 'next'

const apiBaseUrl = process.env.API_BASE_URL ?? 'http://localhost:8787'

const config: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${apiBaseUrl}/api/:path*` },
      { source: '/openapi.json', destination: `${apiBaseUrl}/openapi.json` },
    ]
  },
}

export default config
