/**
 * GET /api/admin/dashboard
 * Returns dashboard overview data: season info, lineup status, pipeline step.
 *
 * POST /api/admin/dashboard
 * Advance a pipeline step manually (e.g. mark "Remind" as done).
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

    // Determine post-night pipeline step
    // Check manual override first, then verifiable state
    let pipelineStep = 'idle';
    let recentScoreWeek: number | null = null;
    if (season) {
      const nextWeek = publishedWeek + 1;

      // Check for manual step override
      try {
        const overrideResult = await db
          .request()
          .input('key', sql.VarChar(50), `postNightStep-w${nextWeek}`)
          .query<{ settingValue: string }>(
            `SELECT settingValue FROM leagueSettings WHERE settingKey = @key`,
          );
        if (overrideResult.recordset[0]) {
          pipelineStep = overrideResult.recordset[0].settingValue;
        }
      } catch {
        // key doesn't exist yet
      }

      // Published status overrides everything
      if (publishedWeek >= nextWeek) {
        pipelineStep = 'published';
      }
    }

    // Determine pre-night pipeline step
    // Check manual override first, then verifiable actions
    let preNightStep = 'idle';
    if (season) {
      const nextWeek = publishedWeek + 1;

      // Check for manual step override (e.g. "preNightStep-w5" = "reminded")
      try {
        const overrideResult = await db
          .request()
          .input('key', sql.VarChar(50), `preNightStep-w${nextWeek}`)
          .query<{ settingValue: string }>(
            `SELECT settingValue FROM leagueSettings WHERE settingKey = @key`,
          );
        if (overrideResult.recordset[0]) {
          preNightStep = overrideResult.recordset[0].settingValue;
        }
      } catch {
        // leagueSettings might not have this key
      }

      // Pushed status overrides everything
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

const PRE_NIGHT_ORDER = ['idle', 'reminded', 'pushed', 'printed'];
const POST_NIGHT_ORDER = ['idle', 'pulled', 'reviewed', 'confirmed', 'blogged', 'published', 'emailed'];

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);
  } catch {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  try {
    const { action, week } = await request.json();

    if (action === 'advancePreNight' && week) {
      const db = await getDb();
      const key = `preNightStep-w${week}`;

      // Get current step
      let current = 'idle';
      try {
        const result = await db
          .request()
          .input('key', sql.VarChar(50), key)
          .query<{ settingValue: string }>(
            `SELECT settingValue FROM leagueSettings WHERE settingKey = @key`,
          );
        if (result.recordset[0]) {
          current = result.recordset[0].settingValue;
        }
      } catch {
        // key doesn't exist yet
      }

      const currentIdx = PRE_NIGHT_ORDER.indexOf(current);
      const nextStep = PRE_NIGHT_ORDER[currentIdx + 1];
      if (!nextStep) {
        return NextResponse.json({ error: 'Already at last step' }, { status: 400 });
      }

      // Upsert the setting
      await db
        .request()
        .input('key', sql.VarChar(50), key)
        .input('value', sql.VarChar(50), nextStep)
        .query(`
          MERGE leagueSettings AS target
          USING (SELECT @key AS settingKey) AS source
          ON target.settingKey = source.settingKey
          WHEN MATCHED THEN UPDATE SET settingValue = @value
          WHEN NOT MATCHED THEN INSERT (settingKey, settingValue) VALUES (@key, @value);
        `);

      return NextResponse.json({ step: nextStep });
    }

    if (action === 'advancePostNight' && week) {
      const db = await getDb();
      const key = `postNightStep-w${week}`;

      let current = 'idle';
      try {
        const result = await db
          .request()
          .input('key', sql.VarChar(50), key)
          .query<{ settingValue: string }>(
            `SELECT settingValue FROM leagueSettings WHERE settingKey = @key`,
          );
        if (result.recordset[0]) {
          current = result.recordset[0].settingValue;
        }
      } catch {
        // key doesn't exist yet
      }

      const currentIdx = POST_NIGHT_ORDER.indexOf(current);
      const nextStep = POST_NIGHT_ORDER[currentIdx + 1];
      if (!nextStep) {
        return NextResponse.json({ error: 'Already at last step' }, { status: 400 });
      }

      await db
        .request()
        .input('key', sql.VarChar(50), key)
        .input('value', sql.VarChar(50), nextStep)
        .query(`
          MERGE leagueSettings AS target
          USING (SELECT @key AS settingKey) AS source
          ON target.settingKey = source.settingKey
          WHEN MATCHED THEN UPDATE SET settingValue = @value
          WHEN NOT MATCHED THEN INSERT (settingKey, settingValue) VALUES (@key, @value);
        `);

      return NextResponse.json({ step: nextStep });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    console.error('Dashboard POST error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update' },
      { status: 500 },
    );
  }
}
