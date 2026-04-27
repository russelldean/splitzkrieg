import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import { requireAdminOrWriter } from '@/lib/admin/auth';
import { getDb, withRetry } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * POST: Generate an auto-draft blog post from confirmed scores for a given season/week.
 * Returns { title, slug, content, type, seasonRomanNumeral, seasonSlug, week }.
 *
 * The draft content uses the <WeekRecap> MDX component to render live stat blocks,
 * matching the existing blog post pattern. Narrative sections are left as placeholders.
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

    // Build draft content using the WeekRecap component (same as existing blog)
    const title = `Season ${romanNumeral} - Week ${week} Recap`;
    const slug = `season-${romanNumeral.toLowerCase()}-week-${week}-recap`;

    const content = `{/* Write your recap here */}

<WeekRecap season="${romanNumeral}" seasonSlug="${seasonSlug}" week="${week}" />
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
