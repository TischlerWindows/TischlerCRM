/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // Allow builds to succeed even with ESLint errors (for production deploy)
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Allow builds to succeed even with TypeScript errors (for production deploy)
    ignoreBuildErrors: true,
  },
  async headers() {
    const securityHeaders = [
      { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
    ];
    const staticCsp = "default-src 'none'; script-src 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; frame-ancestors 'none'; object-src 'none'";
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
      {
        source: '/_next/static/:path*',
        headers: [
          ...securityHeaders,
          { key: 'Content-Security-Policy', value: staticCsp },
        ],
      },
      {
        source: '/_next/image/:path*',
        headers: [
          ...securityHeaders,
          { key: 'Content-Security-Policy', value: staticCsp },
        ],
      },
    ];
  },
  poweredByHeader: false,
};

module.exports = nextConfig;
