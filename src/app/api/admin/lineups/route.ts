import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/auth';
import { getLineups, editLineup, getSeasonTeams } from '@/lib/admin/lineups';

/**
 * GET: Return all lineups and teams for a given seasonID/week.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await requireAdmin(request);
  } catch {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  try {
    const seasonID = parseInt(
      request.nextUrl.searchParams.get('seasonID') || '',
      10,
    );
    const week = parseInt(
      request.nextUrl.searchParams.get('week') || '',
      10,
    );

    if (isNaN(seasonID) || isNaN(week)) {
      return NextResponse.json(
        { error: 'seasonID and week query params required' },
        { status: 400 },
      );
    }

    const [lineups, teams] = await Promise.all([
      getLineups(seasonID, week),
      getSeasonTeams(seasonID),
    ]);

    return NextResponse.json({ lineups, teams });
  } catch (err) {
    console.error('Admin lineups GET error:', err);
    return NextResponse.json(
      { error: 'Failed to load lineups' },
      { status: 500 },
    );
  }
}

/**
 * PUT: Admin edits a lineup submission.
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    await requireAdmin(request);
  } catch {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  try {
    const { submissionID, entries } = await request.json();

    if (!submissionID || !Array.isArray(entries)) {
      return NextResponse.json(
        { error: 'submissionID and entries are required' },
        { status: 400 },
      );
    }

    await editLineup(submissionID, entries);

    return NextResponse.json({ updated: true });
  } catch (err) {
    console.error('Admin lineups PUT error:', err);
    return NextResponse.json(
      { error: 'Failed to edit lineup' },
      { status: 500 },
    );
  }
}
