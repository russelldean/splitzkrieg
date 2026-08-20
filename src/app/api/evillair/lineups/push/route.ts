import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/auth';
import { pushLineupsToLP } from '@/lib/admin/lineups';
import { actionKeys, recordAction } from '@/lib/admin/action-log';

/**
 * POST: Push all lineups for a season/week to LeaguePals.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    await requireAdmin(request);
  } catch {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  try {
    const { cookie, seasonID, week, teamID } = await request.json();

    if (!cookie || !seasonID || !week) {
      return NextResponse.json(
        { error: 'cookie, seasonID, and week are required' },
        { status: 400 },
      );
    }

    const result = await pushLineupsToLP(cookie, seasonID, week, teamID);

    // Only a full-week push counts for the board. A single-team push is a
    // repair, not the step, and a push that pushed nothing is not the step
    // either: LP failures (an expired cookie is the common one) return
    // pushed: 0, and recording those would show the board a green row for a
    // week where nothing reached LeaguePals.
    if (!teamID && result.pushed > 0) {
      await recordAction(actionKeys.lpPush(seasonID, week));
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error('LP push error:', err);
    return NextResponse.json(
      { error: 'Failed to push lineups' },
      { status: 500 },
    );
  }
}
