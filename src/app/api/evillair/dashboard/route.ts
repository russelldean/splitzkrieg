/**
 * GET /api/evillair/dashboard
 * Returns dashboard overview data: season info, lineup status.
 */

import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import { requireAdmin } from '@/lib/admin/auth';
import { getDb } from '@/lib/db';
import { getCurrentLineupContext, getTeamsBowlingForWeek } from '@/lib/admin/lineups';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
  } catch {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  try {
    const db = await getDb();

    // Get current season
    const seasonResult = await db.request().query<{
      seasonID: number;
      displayName: string;
    }>(
      `SELECT TOP 1 seasonID, displayName
       FROM seasons
       ORDER BY year DESC, CASE period WHEN 'Fall' THEN 2 ELSE 1 END DESC`,
    );
    const season = seasonResult.recordset[0] || null;

    // Get published week
    let publishedWeek = 0;
    try {
      const lsResult = await db
        .request()
        .query<{ settingValue: string }>(
          `SELECT settingValue FROM leagueSettings WHERE settingKey = 'publishedWeek'`,
        );
      if (lsResult.recordset[0]) {
        publishedWeek = parseInt(lsResult.recordset[0].settingValue, 10) || 0;
      }
    } catch {
      // leagueSettings might not exist
    }

    // Lineup status for next week. Uses the shared lineup context so playoff
    // weeks pick the right round (and team list) automatically.
    let lineupStatus = null;
    const lineupContext = await getCurrentLineupContext();
    const nextWeek = lineupContext?.nextWeek ?? publishedWeek + 1;
    if (season && lineupContext) {
      const teams = await getTeamsBowlingForWeek(season.seasonID, nextWeek);

      const lineupsResult = await db
        .request()
        .input('seasonID', sql.Int, season.seasonID)
        .input('week', sql.Int, nextWeek)
        .query<{ teamID: number }>(
          `SELECT DISTINCT teamID FROM lineupSubmissions
           WHERE seasonID = @seasonID AND week = @week`,
        );

      const submittedTeamIDs = new Set(lineupsResult.recordset.map((r) => r.teamID));

      lineupStatus = {
        week: nextWeek,
        submitted: submittedTeamIDs.size,
        total: teams.length,
        teams: teams.map((t) => ({
          teamID: t.teamID,
          teamName: t.teamName,
          submitted: submittedTeamIDs.has(t.teamID),
        })),
      };
    }

    return NextResponse.json({
      season,
      publishedWeek,
      lineupStatus,
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load dashboard' },
      { status: 500 },
    );
  }
}
