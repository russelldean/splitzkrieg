import type { NextConfig } from "next";
import withBundleAnalyzer from "@next/bundle-analyzer";
import { fetchRecapRedirects } from "./src/lib/recap-redirects";

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
  async redirects() {
    return [
      // Team renamed Bowl Durham -> High Rollers (2026-07-11); keep old shared
      // links alive.
      { source: '/team/bowl-durham', destination: '/team/high-rollers', permanent: true },
      // Weekly recaps live on their week page now. These give the old blog URLs
      // a real 307 instead of the one-second meta refresh a prerendered
      // redirect() produces. Built from the database, so a recap with a custom
      // slug is covered too. Empty if the DB is unreachable at build.
      ...(await fetchRecapRedirects()),
    ];
  },
};

export default withBundleAnalyzer({ enabled: process.env.ANALYZE === "true" })(nextConfig);
