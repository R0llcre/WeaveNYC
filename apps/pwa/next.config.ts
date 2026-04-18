import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'export',
  images: { unoptimized: true },
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  reactStrictMode: true,
  trailingSlash: true,
};

export default nextConfig;
