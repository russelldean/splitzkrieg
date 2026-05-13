/**
 * POST /api/evillair/playoffs/save-scoresheet
 * Save (upsert) playoff score rows for one (seasonID, round).
 *
 * Body: { seasonID, round, rows: PlayoffScoreInput[] }
 *
 * Each row represents one bowler's 3 games. teamID and/or championshipType
 * must be set on each row. Re-posting overwrites existing rows by
 * (seasonID, bowlerID, round).
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/auth';
import {
  savePlayoffScores,
  bumpPlayoffScoresVersion,
  type PlayoffScoreInput,
} from '@/lib/admin/playoff-scores-admin';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);
  } catch {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { seasonID, round, rows } = body as {
      seasonID: number;
      round: 1 | 2;
      rows: PlayoffScoreInput[];
    };

    if (!seasonID || !round || !Array.isArray(rows)) {
      return NextResponse.json(
        { error: 'seasonID, round, and rows[] are required' },
        { status: 400 },
      );
    }
    if (round !== 1 && round !== 2) {
      return NextResponse.json({ error: 'round must be 1 or 2' }, { status: 400 });
    }
    if (rows.length === 0) {
      return NextResponse.json({ error: 'rows must not be empty' }, { status: 400 });
    }

    await savePlayoffScores(seasonID, round, rows);
    bumpPlayoffScoresVersion(seasonID);
    return NextResponse.json({ ok: true, count: rows.length });
  } catch (err) {
    console.error('save-scoresheet error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to save' },
      { status: 500 },
    );
  }
}
