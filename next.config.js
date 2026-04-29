/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  experimental: {
    serverComponentsExternalPackages: [
      '@react-pdf/renderer',
      'xlsx',
      '@electric-sql/pglite',
      'pg',
      '@azure/storage-blob',
      '@azure/identity',
    ],
  },
};
module.exports = nextConfig;
