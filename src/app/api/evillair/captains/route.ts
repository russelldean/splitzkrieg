/**
 * GET /api/evillair/captains - all current season teams with captain info
 * PUT /api/evillair/captains - update captain (bowlerID) and email for a team
 */

import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import { requireAdmin } from '@/lib/admin/auth';
import { getDb, withRetry } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
  } catch {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  try {
    const db = await getDb();

    // All teams in current season with captain info
    const teamsResult = await withRetry(
      () =>
        db.request().query(`
          SELECT DISTINCT t.teamID, t.teamName, t.captainBowlerID,
                 b.bowlerName AS captainName, b.email AS captainEmail
          FROM schedule sch
          JOIN teams t ON t.teamID = sch.team1ID OR t.teamID = sch.team2ID
          LEFT JOIN bowlers b ON t.captainBowlerID = b.bowlerID
          WHERE sch.seasonID = (
            SELECT TOP 1 seasonID FROM seasons
            ORDER BY year DESC, CASE period WHEN 'Fall' THEN 2 ELSE 1 END DESC
          )
            AND sch.team1ID IS NOT NULL AND sch.team2ID IS NOT NULL
          ORDER BY t.teamName
        `),
      'getCaptainTeams',
    );

    // All eligible bowlers for the picker
    const bowlersResult = await withRetry(
      () =>
        db.request().query(
          `SELECT bowlerID, bowlerName FROM bowlers WHERE isEligible = 1 ORDER BY bowlerName`,
        ),
      'getCaptainBowlers',
    );

    return NextResponse.json({
      teams: teamsResult.recordset.map((r) => ({
        teamID: r.teamID,
        teamName: r.teamName,
        captainBowlerID: r.captainBowlerID ?? null,
        captainName: r.captainName ?? null,
        captainEmail: r.captainEmail ?? null,
      })),
      bowlers: bowlersResult.recordset.map((r) => ({
        bowlerID: r.bowlerID,
        bowlerName: r.bowlerName,
      })),
    });
  } catch (err) {
    console.error('Admin captains GET error:', err);
    return NextResponse.json(
      { error: 'Failed to load captains' },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireAdmin(request);
  } catch {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  try {
    const { teamID, bowlerID, email } = await request.json();
    if (!teamID) {
      return NextResponse.json({ error: 'teamID is required' }, { status: 400 });
    }

    const db = await getDb();

    // Update the team's captain
    await withRetry(
      () =>
        db
          .request()
          .input('teamID', sql.Int, teamID)
          .input('bowlerID', sql.Int, bowlerID || null)
          .query('UPDATE teams SET captainBowlerID = @bowlerID WHERE teamID = @teamID'),
      'updateTeamCaptain',
    );

    // Update the bowler's email if a bowler is assigned
    if (bowlerID && email !== undefined) {
      await withRetry(
        () =>
          db
            .request()
            .input('bowlerID', sql.Int, bowlerID)
            .input('email', sql.VarChar(255), email || null)
            .query('UPDATE bowlers SET email = @email WHERE bowlerID = @bowlerID'),
        'updateCaptainEmail',
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Admin captains PUT error:', err);
    return NextResponse.json(
      { error: 'Failed to update captain' },
      { status: 500 },
    );
  }
}
