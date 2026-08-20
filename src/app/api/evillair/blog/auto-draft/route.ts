import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import { requireAdminOrWriter } from '@/lib/admin/auth';
import { getDb, withRetry } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * POST: Generate an auto-draft blog post from confirmed scores for a given season/week.
 * Returns { title, slug, content, type, seasonRomanNumeral, seasonSlug, week }.
 *
 * The draft is narrative only. Every stat on the week page comes from the page
 * itself, so a draft that embeds stat blocks would duplicate what the reader
 * already sees. The old <WeekRecap> component was deleted for that reason.
 */
export async function POST(request: NextRequest) {
  try {
    await requireAdminOrWriter(request);
  } catch {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { seasonID, week } = body as { seasonID: number; week: number };

    if (!seasonID || !week) {
      return NextResponse.json(
        { error: 'seasonID and week are required' },
        { status: 400 },
      );
    }

    const db = await getDb();

    // Get season info
    const seasonResult = await withRetry(
      () =>
        db
          .request()
          .input('sid', sql.Int, seasonID)
          .query(
            `SELECT romanNumeral, displayName FROM seasons WHERE seasonID = @sid`,
          ),
      'autoDraftSeason',
    );

    if (seasonResult.recordset.length === 0) {
      return NextResponse.json(
        { error: 'Season not found' },
        { status: 404 },
      );
    }

    const { romanNumeral, displayName } = seasonResult.recordset[0];
    const seasonSlug = displayName.toLowerCase().replace(/ /g, '-');

    // Verify scores exist for this week
    const scoreCheck = await withRetry(
      () =>
        db
          .request()
          .input('sid', sql.Int, seasonID)
          .input('week', sql.Int, week)
          .query(
            `SELECT COUNT(*) AS cnt FROM scores WHERE seasonID = @sid AND week = @week`,
          ),
      'autoDraftScoreCheck',
    );

    if (scoreCheck.recordset[0].cnt === 0) {
      return NextResponse.json(
        { error: `No scores found for Season ${romanNumeral} Week ${week}` },
        { status: 404 },
      );
    }

    // Draft body is prose only. The week's stats render on the week page itself
    // now, so embedding <WeekRecap /> here would show a block in draft preview
    // that never appears once published: the published post redirects to
    // /week/<seasonSlug>/<week>, where that component is deliberately a no-op.
    const title = `Season ${romanNumeral} - Week ${week} Recap`;
    const slug = `season-${romanNumeral.toLowerCase()}-week-${week}-recap`;

    const content = `{/* Write your recap here. The week's results, standings,
    leaderboards and milestones render automatically at /week/${seasonSlug}/${week}
    - you do not need to embed anything for them. */}
`;

    return NextResponse.json({
      title,
      slug,
      content,
      type: 'recap',
      seasonRomanNumeral: romanNumeral,
      seasonSlug,
      week,
    });
  } catch (err) {
    console.error('Auto-draft error:', err);
    return NextResponse.json(
      { error: 'Failed to generate auto-draft' },
      { status: 500 },
    );
  }
}
