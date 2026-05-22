import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      { source: '/headcount',           destination: '/admin/headcount',           permanent: true },
      { source: '/headcount/analytics', destination: '/admin/headcount/analytics', permanent: true },
      { source: '/admin/users',         destination: '/admin/headcount',           permanent: true },
    ]
  },
}

export default nextConfig
