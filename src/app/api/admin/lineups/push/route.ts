import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/auth';
import { pushLineupsToLP } from '@/lib/admin/lineups';

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
    const { cookie, seasonID, week } = await request.json();

    if (!cookie || !seasonID || !week) {
      return NextResponse.json(
        { error: 'cookie, seasonID, and week are required' },
        { status: 400 },
      );
    }

    const result = await pushLineupsToLP(cookie, seasonID, week);

    return NextResponse.json(result);
  } catch (err) {
    console.error('LP push error:', err);
    return NextResponse.json(
      { error: 'Failed to push lineups' },
      { status: 500 },
    );
  }
}
