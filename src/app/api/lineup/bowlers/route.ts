/**
 * GET /api/lineup/bowlers
 * Public, read-only copy of the admin bowler list (averages + handicaps) for the
 * helpers running the night. No admin auth, and deliberately GET only: nothing
 * here can change a bowler.
 */

import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getBowlerListWithAverages } from '@/lib/admin/bowler-list';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = await getDb();
    const bowlers = await getBowlerListWithAverages(db);
    return NextResponse.json(
      { bowlers },
      {
        // The rolling-average query walks every bowler's history. Averages only
        // move once a week, so let the edge answer repeat visits for 5 minutes.
        headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
      },
    );
  } catch (err) {
    console.error('Public bowler list error:', err);
    return NextResponse.json({ error: 'Failed to load bowlers' }, { status: 500 });
  }
}
