/**
 * On-demand ISR revalidation endpoint.
 *
 * Called after score publish to revalidate current-season pages and
 * only the bowlers who bowled this week — not all 600+.
 */
import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { getDb } from '@/lib/db';
import { tags } from '@/lib/cache-tags';

// Only these tag shapes may be revalidated via the request body, so the
// endpoint can't be used to bust arbitrary tags. Matches the cache-tags vocab.
const ALLOWED_TAG = /^(scores|schedule|playoffs|bowler|team|season)(-\d+)?$|^current-season$/;

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Parse the JSON body once (a request body can only be read once). Supports
  // both secret-in-body and the { tags: [...] } rename/import entrypoint.
  let body: { secret?: string; tags?: unknown } | null = null;
  try {
    body = await request.json();
  } catch {
    // no body / not JSON — query-param secret path
  }

  const secret: string | null = request.nextUrl.searchParams.get('secret') ?? body?.secret ?? null;

  const expectedSecret = process.env.REVALIDATION_SECRET;
  if (!expectedSecret || !secret || secret !== expectedSecret) {
    return NextResponse.json({ message: 'Invalid secret' }, { status: 401 });
  }

  // Targeted entrypoint: { tags: [...] } busts exactly those tags and returns.
  // Used by the bowler/team rename workflow and schedule/playoff imports.
  if (Array.isArray(body?.tags)) {
    const requested = body.tags.filter((t): t is string => typeof t === 'string');
    const valid = requested.filter((t) => ALLOWED_TAG.test(t));
    for (const t of valid) {
      revalidateTag(t, 'max');
    }
    return NextResponse.json({
      revalidated: true,
      tags: valid,
      rejected: requested.filter((t) => !ALLOWED_TAG.test(t)),
    });
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
    // Track #1 pilot: tag-based revalidation for migrated queries (e.g. the
    // current-season snapshot). Fires only when seasonID resolves; path-based
    // revalidation below stays as-is for everything not yet migrated.
    // Next 16: 'max' = stale-while-revalidate (serve stale, refetch in background,
    // lazily on next visit). Recommended over the deprecated single-arg form.
    revalidateTag(tags.scoresForSeason(seasonID), 'max');
    // Coarse channel bust so cross-season boards (all-time, directories) refresh.
    revalidateTag(tags.scoresAll, 'max');

    const weekRes = await db.request().query(
      `SELECT settingValue FROM leagueSettings WHERE settingKey = 'publishedWeek'`
    );
    publishedWeek = parseInt(weekRes.recordset[0]?.settingValue ?? '1', 10);

    // Only bowlers who bowled this week
    const bowlerRes = await db.request()
      .input('sid', seasonID)
      .input('week', publishedWeek)
      .query(`
        SELECT DISTINCT b.slug, b.bowlerID
        FROM scores s
        JOIN bowlers b ON s.bowlerID = b.bowlerID
        WHERE s.seasonID = @sid AND s.week = @week AND s.isPenalty = 0
      `);
    const bowlerRows = bowlerRes.recordset as { slug: string; bowlerID: number }[];
    bowlerSlugs = bowlerRows.map((r) => r.slug);
    // Per-bowler tags for only the bowlers who bowled this week (scoping preserved).
    for (const { bowlerID } of bowlerRows) {
      revalidateTag(tags.bowler(bowlerID), 'max');
    }
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
