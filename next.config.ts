import createMDX from '@next/mdx';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  pageExtensions: ['js', 'jsx', 'md', 'mdx', 'ts', 'tsx'],
};

const withMDX = createMDX({
  // Note: remarkGfm removed — Turbopack in Next.js 16 requires serializable options.
  // GFM features (tables, strikethrough) not needed for blog content yet.
});

export default withMDX(nextConfig);
