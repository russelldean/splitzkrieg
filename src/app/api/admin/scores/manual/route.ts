import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import { requireAdmin } from '@/lib/admin/auth';
import { getDb, withRetry } from '@/lib/db';
import type { StagedMatch, StagedBowler } from '@/lib/admin/types';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);
  } catch {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { seasonID, week } = body as { seasonID: number; week: number };

    if (!seasonID || !week) {
      return NextResponse.json(
        { error: 'Missing required fields: seasonID, week' },
        { status: 400 },
      );
    }

    const db = await getDb();

    // Get schedule matchups for this week
    const scheduleResult = await withRetry(
      () =>
        db
          .request()
          .input('sid', sql.Int, seasonID)
          .input('week', sql.Int, week)
          .query(`
            SELECT s.scheduleID, s.matchNumber, s.team1ID, s.team2ID,
              t1.teamName AS team1Name, t2.teamName AS team2Name
            FROM schedule s
            LEFT JOIN teams t1 ON t1.teamID = s.team1ID
            LEFT JOIN teams t2 ON t2.teamID = s.team2ID
            WHERE s.seasonID = @sid AND s.week = @week
              AND s.team1ID IS NOT NULL AND s.team2ID IS NOT NULL
            ORDER BY s.matchNumber
          `),
      'getSchedule',
    );

    // Build empty match scaffolds
    const matches: StagedMatch[] = scheduleResult.recordset.map(
      (row: {
        scheduleID: number;
        team1ID: number;
        team2ID: number;
        team1Name: string;
        team2Name: string;
      }) => {
        // Create 4 empty bowler slots per team
        const emptyBowlers = (
          teamID: number,
          teamName: string,
        ): StagedBowler[] =>
          Array.from({ length: 4 }, () => ({
            bowlerID: null,
            bowlerName: '',
            teamID,
            teamName,
            game1: null,
            game2: null,
            game3: null,
            turkeys: 0,
            incomingAvg: null,
            isPenalty: false,
            isUnmatched: false,
          }));

        return {
          matchID: row.scheduleID,
          homeTeamID: row.team1ID,
          homeTeamName: row.team1Name,
          awayTeamID: row.team2ID,
          awayTeamName: row.team2Name,
          bowlers: [
            ...emptyBowlers(row.team1ID, row.team1Name),
            ...emptyBowlers(row.team2ID, row.team2Name),
          ],
        };
      },
    );

    // Check if scores already exist for this week
    const existingResult = await withRetry(
      () =>
        db
          .request()
          .input('sid', sql.Int, seasonID)
          .input('week', sql.Int, week)
          .query(
            'SELECT COUNT(*) AS cnt FROM scores WHERE seasonID = @sid AND week = @week',
          ),
      'checkExistingScores',
    );
    const existingCount = existingResult.recordset[0]?.cnt ?? 0;

    return NextResponse.json({
      matches,
      warnings: existingCount > 0
        ? [`${existingCount} scores already exist for this week. Confirming will replace them.`]
        : [],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
