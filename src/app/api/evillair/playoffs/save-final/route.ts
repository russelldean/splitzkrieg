/**
 * POST /api/evillair/playoffs/save-final
 * Insert/replace the team final matchup row. Winner stays NULL until recorded.
 * Body: { seasonID, team1ID, team2ID }
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/auth';
import { saveTeamFinalMatchup } from '@/lib/admin/playoff-admin';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);
  } catch {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { seasonID, team1ID, team2ID } = body as {
      seasonID: number;
      team1ID: number;
      team2ID: number;
    };

    if (!seasonID || !team1ID || !team2ID) {
      return NextResponse.json(
        { error: 'seasonID, team1ID, and team2ID are required' },
        { status: 400 },
      );
    }
    if (team1ID === team2ID) {
      return NextResponse.json({ error: 'A team cannot play itself' }, { status: 400 });
    }

    await saveTeamFinalMatchup(seasonID, team1ID, team2ID);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('save-final error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to save' },
      { status: 500 },
    );
  }
}
