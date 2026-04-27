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

    // Load existing scores for this week (if any)
    const existingScoresResult = await withRetry(
      () =>
        db
          .request()
          .input('sid', sql.Int, seasonID)
          .input('week', sql.Int, week)
          .query(`
            SELECT sc.bowlerID, sc.teamID, sc.game1, sc.game2, sc.game3,
              sc.turkeys, sc.incomingAvg, sc.isPenalty,
              b.bowlerName,
              t.teamName
            FROM scores sc
            JOIN bowlers b ON b.bowlerID = sc.bowlerID
            JOIN teams t ON t.teamID = sc.teamID
            WHERE sc.seasonID = @sid AND sc.week = @week
            ORDER BY sc.teamID, sc.bowlerID
          `),
      'loadExistingScores',
    );

    const existingScores = existingScoresResult.recordset as Array<{
      bowlerID: number;
      teamID: number;
      game1: number | null;
      game2: number | null;
      game3: number | null;
      turkeys: number;
      incomingAvg: number | null;
      isPenalty: boolean;
      bowlerName: string;
      teamName: string;
    }>;

    // Build match scaffolds, pre-filled with existing scores when available
    const matches: StagedMatch[] = scheduleResult.recordset.map(
      (row: {
        scheduleID: number;
        team1ID: number;
        team2ID: number;
        team1Name: string;
        team2Name: string;
      }) => {
        const teamBowlers = (
          teamID: number,
          teamName: string,
        ): StagedBowler[] => {
          const existing = existingScores.filter((s) => s.teamID === teamID);
          if (existing.length > 0) {
            return existing.map((s) => ({
              bowlerID: s.bowlerID,
              bowlerName: s.bowlerName,
              teamID: s.teamID,
              teamName: s.teamName,
              game1: s.game1,
              game2: s.game2,
              game3: s.game3,
              turkeys: s.turkeys ?? 0,
              incomingAvg: s.incomingAvg,
              isPenalty: s.isPenalty,
              isUnmatched: false,
            }));
          }
          // No existing scores: return 4 empty slots
          return Array.from({ length: 4 }, () => ({
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
        };

        return {
          matchID: row.scheduleID,
          homeTeamID: row.team1ID,
          homeTeamName: row.team1Name,
          awayTeamID: row.team2ID,
          awayTeamName: row.team2Name,
          bowlers: [
            ...teamBowlers(row.team1ID, row.team1Name),
            ...teamBowlers(row.team2ID, row.team2Name),
          ],
        };
      },
    );

    const existingCount = existingScores.length;

    return NextResponse.json({
      matches,
      warnings: existingCount > 0
        ? [`${existingCount} scores loaded for editing. Confirming will replace them.`]
        : [],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
