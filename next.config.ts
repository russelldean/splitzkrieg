import type { NextConfig } from "next";
import withBundleAnalyzer from "@next/bundle-analyzer";

const nextConfig: NextConfig = {
  experimental: {
    // Vercel Pro Turbo Build Machines have 30 cores, but Azure SQL Basic
    // only supports 30 concurrent connections. Limit workers so we don't
    // overwhelm the DB during static page generation.
    // Effective concurrent connections = cpus × MAX_CONCURRENT_QUERIES (in db.ts).
    // Max safe value: floor(30 / 7) = 4.
    cpus: 2,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.cdninstagram.com' },
      { protocol: 'https', hostname: '*.fbcdn.net' },
    ],
  },
  // INTERIM (pre-season): serve the Season XXXVI schedule announcement as the
  // front page and hide the season-dependent homepage until the season starts.
  // To restore the normal homepage, delete this rewrites() block.
  async rewrites() {
    return {
      beforeFiles: [{ source: '/', destination: '/schedule.html' }],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default withBundleAnalyzer({ enabled: process.env.ANALYZE === "true" })(nextConfig);
