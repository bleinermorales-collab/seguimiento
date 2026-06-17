import type { NextConfig } from 'next';

const isProd = process.env.NODE_ENV === 'production';
const basePath = isProd ? '/seguimiento' : '';

const nextConfig: NextConfig = {
  serverExternalPackages: ['xlsx', 'googleapis'],
  devIndicators: false,
  basePath,
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
};

export default nextConfig;
