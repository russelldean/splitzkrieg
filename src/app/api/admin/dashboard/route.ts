/**
 * GET /api/admin/dashboard
 * Returns dashboard overview data: season info, lineup status, pipeline step.
 */

import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import { requireAdmin } from '@/lib/admin/auth';
import { getDb } from '@/lib/db';

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

    // Lineup status for next week
    let lineupStatus = null;
    if (season) {
      const nextWeek = publishedWeek + 1;

      // Get all teams for this season
      const teamsResult = await db
        .request()
        .input('seasonID', sql.Int, season.seasonID)
        .query<{ teamID: number; teamName: string }>(
          `SELECT DISTINCT t.teamID, t.teamName
           FROM schedule sch
           JOIN teams t ON t.teamID = sch.team1ID OR t.teamID = sch.team2ID
           WHERE sch.seasonID = @seasonID AND sch.team1ID IS NOT NULL AND sch.team2ID IS NOT NULL
           ORDER BY t.teamName`,
        );

      // Get submitted lineups for this week
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
        total: teamsResult.recordset.length,
        teams: teamsResult.recordset.map((t) => ({
          teamName: t.teamName,
          submitted: submittedTeamIDs.has(t.teamID),
        })),
      };
    }

    // Determine pipeline step based on most recent score data
    let pipelineStep = 'idle';
    let recentScoreWeek: number | null = null;
    if (season) {
      const nextWeek = publishedWeek + 1;

      // Check if scores exist for next week
      const scoreCheck = await db
        .request()
        .input('seasonID', sql.Int, season.seasonID)
        .input('week', sql.Int, nextWeek)
        .query<{ cnt: number }>(
          `SELECT COUNT(*) AS cnt FROM scores WHERE seasonID = @seasonID AND week = @week`,
        );

      if (scoreCheck.recordset[0]?.cnt > 0) {
        pipelineStep = 'confirmed';
        recentScoreWeek = nextWeek;

        // Check if match results exist (means confirm was completed)
        const mrCheck = await db
          .request()
          .input('seasonID', sql.Int, season.seasonID)
          .input('week', sql.Int, nextWeek)
          .query<{ cnt: number }>(
            `SELECT COUNT(*) AS cnt FROM matchResults mr
             JOIN schedule sch ON mr.scheduleID = sch.scheduleID
             WHERE sch.seasonID = @seasonID AND sch.week = @week`,
          );

        if (mrCheck.recordset[0]?.cnt > 0) {
          pipelineStep = 'confirmed';
        }
      }

      // Check published status
      if (publishedWeek >= nextWeek) {
        pipelineStep = 'published';
      }
    }

    // Determine pre-night pipeline step
    let preNightStep = 'idle';
    if (lineupStatus) {
      if (lineupStatus.submitted > 0) {
        preNightStep = 'reminded'; // some lineups are in
      }
      if (lineupStatus.submitted === lineupStatus.total && lineupStatus.total > 0) {
        preNightStep = 'all-submitted';
      }
    }
    // Check if lineups were pushed to LP (look for 'pushed' status)
    if (season) {
      const nextWeek = publishedWeek + 1;
      const pushCheck = await db
        .request()
        .input('seasonID', sql.Int, season.seasonID)
        .input('week', sql.Int, nextWeek)
        .query<{ cnt: number }>(
          `SELECT COUNT(*) AS cnt FROM lineupSubmissions
           WHERE seasonID = @seasonID AND week = @week AND status = 'pushed'`,
        );
      if (pushCheck.recordset[0]?.cnt > 0) {
        preNightStep = 'pushed';
      }
    }

    return NextResponse.json({
      season,
      publishedWeek,
      lineupStatus,
      pipelineStep,
      preNightStep,
      recentScoreWeek,
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load dashboard' },
      { status: 500 },
    );
  }
}
