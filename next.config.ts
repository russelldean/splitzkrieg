import type { NextConfig } from "next";
import withBundleAnalyzer from "@next/bundle-analyzer";

const nextConfig: NextConfig = {
  experimental: {
    // Vercel Pro Turbo Build Machines have 30 cores, but Azure SQL Basic
    // only supports 30 concurrent connections. Limit workers so we don't
    // overwhelm the DB during static page generation.
    // Effective concurrent connections = cpus × MAX_CONCURRENT_QUERIES (in db.ts).
    // Set to 3 for the architectural-fix transition deploy (2026-04-07): the
    // db.ts dependsOn-skip-tag rule changes cache key format for bowler queries,
    // forcing a one-time stampede. With 3 × 7 = 21 max connections we stay safely
    // under Azure SQL's 30-conn limit while bowler pages rebuild from scratch.
    // After this deploy succeeds, future builds will be fast (cache hits) and
    // this can go back to 7.
    cpus: 3,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.cdninstagram.com' },
      { protocol: 'https', hostname: '*.fbcdn.net' },
    ],
  },
};

export default withBundleAnalyzer({ enabled: process.env.ANALYZE === "true" })(nextConfig);
