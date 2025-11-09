/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
  transpilePackages: ['@xyflow/react', '@xyflow/system'],
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@xyflow/react': '@xyflow/react',
    };
    return config;
  },
};

module.exports = nextConfig;
