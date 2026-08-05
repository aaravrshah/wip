import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  agentRules: false,
  reactStrictMode: true,
  transpilePackages: ['@wip/domain'],
};

export default nextConfig;
