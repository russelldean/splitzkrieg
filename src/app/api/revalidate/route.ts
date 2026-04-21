/**
 * On-demand ISR revalidation endpoint.
 *
 * Called after score publish to revalidate current-season pages and
 * only the bowlers who bowled this week — not all 600+.
 */
import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getDb } from '@/lib/db';

export async function POST(request: NextRequest): Promise<NextResponse> {
  let secret: string | null = request.nextUrl.searchParams.get('secret');

  if (!secret) {
    try {
      const body = await request.json();
      secret = body?.secret ?? null;
    } catch {
      // not JSON
    }
  }

  const expectedSecret = process.env.REVALIDATION_SECRET;
  if (!expectedSecret || !secret || secret !== expectedSecret) {
    return NextResponse.json({ message: 'Invalid secret' }, { status: 401 });
  }

  let seasonSlug = 'spring-2026';
  let publishedWeek = 1;
  let bowlerSlugs: string[] = [];

  try {
    const db = await getDb();

    const seasonRes = await db.request().query(`
      SELECT seasonID, LOWER(period) + '-' + CAST(year AS VARCHAR) AS slug
      FROM seasons WHERE isCurrentSeason = 1
    `);
    const { seasonID, slug } = seasonRes.recordset[0];
    seasonSlug = slug;

    const weekRes = await db.request().query(
      `SELECT settingValue FROM leagueSettings WHERE settingKey = 'publishedWeek'`
    );
    publishedWeek = parseInt(weekRes.recordset[0]?.settingValue ?? '1', 10);

    // Only bowlers who bowled this week
    const bowlerRes = await db.request()
      .input('sid', seasonID)
      .input('week', publishedWeek)
      .query(`
        SELECT DISTINCT b.slug
        FROM scores s
        JOIN bowlers b ON s.bowlerID = b.bowlerID
        WHERE s.seasonID = @sid AND s.week = @week AND s.isPenalty = 0
      `);
    bowlerSlugs = bowlerRes.recordset.map((r: { slug: string }) => r.slug);
  } catch {
    // Fall back to homepage-only revalidation
  }

  // Current season pages
  revalidatePath('/');
  revalidatePath(`/season/${seasonSlug}`);
  revalidatePath(`/season/${seasonSlug}/standings`);
  revalidatePath(`/season/${seasonSlug}/stats`);

  // Week pages for current season
  for (let w = 1; w <= 11; w++) {
    revalidatePath(`/week/${seasonSlug}/${w}`);
  }

  // Only bowlers who bowled this week
  for (const slug of bowlerSlugs) {
    revalidatePath(`/bowler/${slug}`);
  }

  return NextResponse.json({
    revalidated: true,
    seasonSlug,
    publishedWeek,
    bowlersRevalidated: bowlerSlugs.length,
    now: Date.now(),
  });
}
