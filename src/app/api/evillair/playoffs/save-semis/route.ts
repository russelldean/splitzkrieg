/**
 * POST /api/evillair/playoffs/save-semis
 * Save the two semifinal matchups for the season. Replaces existing rows.
 * Body: { seasonID, matchups: [{ team1ID, team2ID }, { team1ID, team2ID }] }
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/auth';
import { saveSemifinalMatchups } from '@/lib/admin/playoff-admin';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);
  } catch {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { seasonID, matchups } = body as {
      seasonID: number;
      matchups: Array<{ team1ID: number; team2ID: number }>;
    };

    if (!seasonID || !Array.isArray(matchups) || matchups.length !== 2) {
      return NextResponse.json(
        { error: 'seasonID and exactly 2 matchups required' },
        { status: 400 },
      );
    }

    for (const m of matchups) {
      if (!m.team1ID || !m.team2ID || m.team1ID === m.team2ID) {
        return NextResponse.json(
          { error: 'Each matchup needs two distinct team IDs' },
          { status: 400 },
        );
      }
    }

    const allTeamIDs = matchups.flatMap(m => [m.team1ID, m.team2ID]);
    if (new Set(allTeamIDs).size !== 4) {
      return NextResponse.json(
        { error: 'A team cannot appear in both semifinals' },
        { status: 400 },
      );
    }

    await saveSemifinalMatchups(seasonID, matchups);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('save-semis error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to save' },
      { status: 500 },
    );
  }
}
