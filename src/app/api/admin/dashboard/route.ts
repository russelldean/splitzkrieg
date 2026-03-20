/**
 * GET /api/admin/dashboard
 * Returns dashboard overview data: season info, lineup status, completed steps.
 *
 * POST /api/admin/dashboard
 * Toggle a pipeline step as done/undone.
 * Body: { pipeline: 'pre' | 'post', stepKey: string, week: number }
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
          teamID: t.teamID,
          teamName: t.teamName,
          submitted: submittedTeamIDs.has(t.teamID),
        })),
      };
    }

    // Load completed steps for this week (stored as comma-separated keys)
    let preNightDone: string[] = [];
    let postNightDone: string[] = [];
    if (season) {
      const nextWeek = publishedWeek + 1;
      try {
        const result = await db
          .request()
          .input('preKey', sql.VarChar(50), `preNightDone-w${nextWeek}`)
          .input('postKey', sql.VarChar(50), `postNightDone-w${nextWeek}`)
          .query<{ settingKey: string; settingValue: string }>(
            `SELECT settingKey, settingValue FROM leagueSettings
             WHERE settingKey IN (@preKey, @postKey)`,
          );
        for (const row of result.recordset) {
          const val = row.settingValue ? row.settingValue.split(',').filter(Boolean) : [];
          if (row.settingKey.startsWith('preNight')) preNightDone = val;
          else postNightDone = val;
        }
      } catch {
        // leagueSettings might not have these keys
      }
    }

    return NextResponse.json({
      season,
      publishedWeek,
      lineupStatus,
      preNightDone,
      postNightDone,
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load dashboard' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);
  } catch {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  try {
    const { pipeline, stepKey, week } = await request.json();
    if (!pipeline || !stepKey || !week) {
      return NextResponse.json(
        { error: 'pipeline, stepKey, and week are required' },
        { status: 400 },
      );
    }

    const db = await getDb();
    const settingKey =
      pipeline === 'pre' ? `preNightDone-w${week}` : `postNightDone-w${week}`;

    // Get current set
    let current: string[] = [];
    try {
      const result = await db
        .request()
        .input('key', sql.VarChar(50), settingKey)
        .query<{ settingValue: string }>(
          `SELECT settingValue FROM leagueSettings WHERE settingKey = @key`,
        );
      if (result.recordset[0]?.settingValue) {
        current = result.recordset[0].settingValue.split(',').filter(Boolean);
      }
    } catch {
      // doesn't exist yet
    }

    // Toggle
    if (current.includes(stepKey)) {
      current = current.filter((k) => k !== stepKey);
    } else {
      current.push(stepKey);
    }

    const value = current.join(',');

    await db
      .request()
      .input('key', sql.VarChar(50), settingKey)
      .input('value', sql.VarChar(255), value)
      .query(`
        MERGE leagueSettings AS target
        USING (SELECT @key AS settingKey) AS source
        ON target.settingKey = source.settingKey
        WHEN MATCHED THEN UPDATE SET settingValue = @value
        WHEN NOT MATCHED THEN INSERT (settingKey, settingValue) VALUES (@key, @value);
      `);

    return NextResponse.json({ done: current });
  } catch (err) {
    console.error('Dashboard POST error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update' },
      { status: 500 },
    );
  }
}
