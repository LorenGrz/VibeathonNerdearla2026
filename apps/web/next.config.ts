import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Lets `next dev` serve its client bundles when opened via 127.0.0.1 instead of localhost.
  allowedDevOrigins: ['127.0.0.1'],
};

export default nextConfig;
