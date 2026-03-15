import { NextRequest, NextResponse } from 'next/server';
import {
  submitLineup,
  getLastWeekLineup,
  getAllBowlers,
  getRecentRoster,
  getCurrentLineupContext,
  getSeasonTeams,
  getSubmittedTeamIDs,
} from '@/lib/admin/lineups';

export const dynamic = 'force-dynamic';

/**
 * GET: Return lineup context.
 * Without ?teamID: returns season info + team list (for team picker).
 * With ?teamID=N: returns full lineup context for that team.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const context = await getCurrentLineupContext();
    if (!context) {
      return NextResponse.json(
        { error: 'No active season found' },
        { status: 404 },
      );
    }

    const teamIDParam = request.nextUrl.searchParams.get('teamID');

    // No teamID: return season info + teams with submission status
    if (!teamIDParam) {
      const teams = await getSeasonTeams(context.seasonID);
      const submitted = await getSubmittedTeamIDs(context.seasonID, context.nextWeek);
      const teamsWithStatus = teams.map((t) => ({
        ...t,
        submitted: submitted.has(t.teamID),
      }));
      return NextResponse.json({
        seasonID: context.seasonID,
        seasonName: context.seasonName,
        week: context.nextWeek,
        teams: teamsWithStatus,
      });
    }

    // With teamID: return full context for lineup form
    const teamID = parseInt(teamIDParam, 10);
    if (isNaN(teamID)) {
      return NextResponse.json({ error: 'Invalid teamID' }, { status: 400 });
    }

    const [bowlers, recentRoster, lastWeekLineup] = await Promise.all([
      getAllBowlers(),
      getRecentRoster(teamID, context.seasonID),
      getLastWeekLineup(teamID, context.seasonID, context.nextWeek),
    ]);

    return NextResponse.json({
      teamID,
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
 * POST: Submit a lineup. Replaces any existing submission for the same team/season/week.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { teamID, seasonID, week, entries, submittedBy } = await request.json();

    if (!teamID || !seasonID || !week || !Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json(
        { error: 'teamID, seasonID, week, and entries are required' },
        { status: 400 },
      );
    }

    const submissionID = await submitLineup(
      seasonID,
      week,
      teamID,
      submittedBy || 'Captain',
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
