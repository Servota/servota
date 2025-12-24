import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: [
        'https://cuddly-barnacle-wrj4r5v464x5f5q65-3000.app.github.dev',
        'http://localhost:3000',
      ],
    },
  },
};

export default nextConfig;
