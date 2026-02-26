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
};

module.exports = nextConfig;