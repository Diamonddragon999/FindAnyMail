/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['cheerio', 'net', 'dns', 'crypto'],
  experimental: {
    serverActions: {
      bodySizeLimit: '4mb',
    },
  },
};

export default nextConfig;
