/**
 * GET /api/evillair/playoffs/scoresheet?seasonID=X&round=Y
 * Returns all saved playoff score rows for one (seasonID, round). Used by the
 * scoresheet entry client to refresh state after each save instead of relying
 * on Next router.refresh, which has been unreliable in dev for this page.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/auth';
import { getPlayoffScoresForRound } from '@/lib/admin/playoff-scores-admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
  } catch {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  const seasonID = Number(request.nextUrl.searchParams.get('seasonID'));
  const round = Number(request.nextUrl.searchParams.get('round'));
  if (!seasonID || (round !== 1 && round !== 2)) {
    return NextResponse.json(
      { error: 'seasonID and round (1|2) are required' },
      { status: 400 },
    );
  }

  const rows = await getPlayoffScoresForRound(seasonID, round as 1 | 2);
  return NextResponse.json({ rows });
}
