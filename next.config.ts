import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Vercel Pro Turbo Build Machines have 30 cores, but Azure SQL Basic
    // only supports 30 concurrent connections. Limit workers so we don't
    // overwhelm the DB during static page generation.
    cpus: 7,
  },
};

export default nextConfig;
