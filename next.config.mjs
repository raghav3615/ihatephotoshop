/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: process.cwd(),
  experimental: {
    cpus: 1,
    workerThreads: false,
  },
};

export default nextConfig;

