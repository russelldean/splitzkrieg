/**
 * GET /api/blog-badge
 *
 * Public state for the header's "New" blog pill.
 *
 * The badge used to be resolved during prerender in Header and passed down
 * as a prop, which meant promoting a post had to call
 * revalidatePath('/', 'layout') to take effect. With BUILD_ALL=1 that
 * invalidated all ~1179 prebuilt pages, so the next visitor to any of them
 * paid for a live re-render against Azure SQL. Reading the badge here
 * instead removes that purge entirely.
 *
 * Edge-cached, so the DB sees roughly one query per 5 minutes rather than
 * one per page view.
 */
import { NextResponse } from 'next/server';
import { getNewBlogBadgeId } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export async function GET() {
  const badgeId = await getNewBlogBadgeId();
  return NextResponse.json(
    { badgeId },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    },
  );
}
