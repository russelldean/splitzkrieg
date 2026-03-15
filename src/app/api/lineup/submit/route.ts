import { NextRequest, NextResponse } from 'next/server';
import { requireCaptain } from '@/lib/admin/auth';
import {
  submitLineup,
  getLastWeekLineup,
  getAllBowlers,
  getRecentRoster,
  getCurrentLineupContext,
} from '@/lib/admin/lineups';

/**
 * GET: Return lineup context for the captain form.
 * Includes bowler list, recent roster, current lineup context, and last week's lineup.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  let payload;
  try {
    payload = await requireCaptain(request);
  } catch {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  try {
    const teamID = payload.teamID!;
    const context = await getCurrentLineupContext();

    if (!context) {
      return NextResponse.json(
        { error: 'No active season found' },
        { status: 404 },
      );
    }

    const [bowlers, recentRoster, lastWeekLineup] = await Promise.all([
      getAllBowlers(),
      getRecentRoster(teamID, context.seasonID),
      getLastWeekLineup(teamID, context.seasonID, context.nextWeek),
    ]);

    return NextResponse.json({
      teamID,
      captainName: payload.captainName,
      seasonID: context.seasonID,
      seasonName: context.seasonName,
      week: context.nextWeek,
      bowlers,
      recentRoster,
      lastWeekLineup,
    });
  } catch (err) {
    console.error('Lineup context error:', err);
    return NextResponse.json(
      { error: 'Failed to load lineup context' },
      { status: 500 },
    );
  }
}

/**
 * POST: Submit a lineup for the captain's team.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  let payload;
  try {
    payload = await requireCaptain(request);
  } catch {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  try {
    const { seasonID, week, entries } = await request.json();

    if (!seasonID || !week || !Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json(
        { error: 'seasonID, week, and entries are required' },
        { status: 400 },
      );
    }

    const teamID = payload.teamID!;
    const submittedBy = payload.captainName || 'Captain';

    const submissionID = await submitLineup(
      seasonID,
      week,
      teamID,
      submittedBy,
      entries,
    );

    return NextResponse.json({ submissionID });
  } catch (err) {
    console.error('Lineup submit error:', err);
    return NextResponse.json(
      { error: 'Failed to submit lineup' },
      { status: 500 },
    );
  }
}
