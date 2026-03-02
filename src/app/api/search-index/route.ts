/**
 * Static route handler that generates the bowler search index at build time.
 *
 * `force-static` tells Next.js to pre-render this route during `next build`.
 * The output is cached as a static JSON file — no server function at runtime.
 */
import { NextResponse } from 'next/server';
import { generateSearchIndex } from '@/lib/search-index';

export const dynamic = 'force-static';

export async function GET() {
  const entries = await generateSearchIndex();
  return NextResponse.json(entries);
}
