/**
 * POST /api/evillair/playoffs/record-semi-winner
 * Record the winner of a semifinal. Updates playoffResults.winnerTeamID.
 * Body: { playoffID, winnerTeamID }
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/auth';
import { recordSemifinalWinner } from '@/lib/admin/playoff-admin';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);
  } catch {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { playoffID, winnerTeamID } = body as { playoffID: number; winnerTeamID: number };

    if (!playoffID || !winnerTeamID) {
      return NextResponse.json(
        { error: 'playoffID and winnerTeamID are required' },
        { status: 400 },
      );
    }

    await recordSemifinalWinner(playoffID, winnerTeamID);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('record-semi-winner error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to save' },
      { status: 500 },
    );
  }
}
