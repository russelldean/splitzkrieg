/**
 * On-demand ISR revalidation endpoint.
 *
 * Called after biweekly data syncs to mark all pages as stale.
 * Regeneration happens on next visit (stale-while-revalidate).
 *
 * Usage:
 *   curl -X POST "https://splitzkrieg.com/api/revalidate?secret=YOUR_SECRET"
 *
 * Protected by REVALIDATION_SECRET env var — returns 401 on mismatch.
 */
import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Accept secret from query param or request body JSON.
  let secret: string | null = request.nextUrl.searchParams.get('secret');

  if (!secret) {
    try {
      const body = await request.json();
      secret = body?.secret ?? null;
    } catch {
      // Body is not JSON or is empty — secret remains null.
    }
  }

  const expectedSecret = process.env.REVALIDATION_SECRET;

  if (!expectedSecret || !secret || secret !== expectedSecret) {
    return NextResponse.json({ message: 'Invalid secret' }, { status: 401 });
  }

  // Revalidate the entire site layout, which invalidates all pages.
  revalidatePath('/', 'layout');

  return NextResponse.json({ revalidated: true, now: Date.now() });
}
