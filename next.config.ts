import type { NextConfig } from "next";
import withBundleAnalyzer from "@next/bundle-analyzer";

const nextConfig: NextConfig = {
  experimental: {
    // Vercel Pro Turbo Build Machines have 30 cores, but Azure SQL Basic
    // only supports 30 concurrent connections. The DB ceiling is governed by
    // cpus × MAX_CONCURRENT_QUERIES (in db.ts) — NOT by cpus alone, because
    // warm cache hits render without opening a connection. So we run more
    // render workers while lowering per-worker query concurrency, keeping the
    // connection product at the proven-safe 20 (10 × 2) but ~2.5x the render
    // parallelism vs the old 4 × 5. See db.ts MAX_CONCURRENT_QUERIES.
    cpus: 10,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.cdninstagram.com' },
      { protocol: 'https', hostname: '*.fbcdn.net' },
    ],
  },
};

export default withBundleAnalyzer({ enabled: process.env.ANALYZE === "true" })(nextConfig);
