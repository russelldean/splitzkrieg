/**
 * GET /api/admin/captains - list all team captains with emails
 * PUT /api/admin/captains - update a bowler's email
 *
 * Captain info comes from teams.captainBowlerID -> bowlers.email
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
    const result = await withRetry(
      () =>
        db.request().query(`
          SELECT t.teamID, t.teamName, t.captainBowlerID,
                 b.bowlerName, b.email
          FROM teams t
          LEFT JOIN bowlers b ON t.captainBowlerID = b.bowlerID
          WHERE t.captainBowlerID IS NOT NULL
          ORDER BY t.teamName
        `),
      'getCaptains',
    );
    return NextResponse.json({
      captains: result.recordset.map((r) => ({
        teamID: r.teamID,
        teamName: r.teamName,
        bowlerID: r.captainBowlerID,
        bowlerName: r.bowlerName,
        email: r.email ?? null,
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
    const { bowlerID, email } = await request.json();
    if (!bowlerID) {
      return NextResponse.json({ error: 'bowlerID is required' }, { status: 400 });
    }

    const db = await getDb();
    await withRetry(
      () =>
        db
          .request()
          .input('bowlerID', sql.Int, bowlerID)
          .input('email', sql.VarChar(255), email || null)
          .query('UPDATE bowlers SET email = @email WHERE bowlerID = @bowlerID'),
      'updateCaptainEmail',
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Admin captains PUT error:', err);
    return NextResponse.json(
      { error: 'Failed to update email' },
      { status: 500 },
    );
  }
}
