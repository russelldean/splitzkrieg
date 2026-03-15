/**
 * POST /api/admin/scoresheets/preview
 * Return matchup summary for scoresheet preview (team names + bowler counts).
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/auth';
import { getMatchupsForWeek } from '@/lib/admin/scoresheets';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);
  } catch {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { seasonID, week, source } = body as {
      seasonID: number;
      week: number;
      source?: 'lineups' | 'lastweek';
    };

    if (!seasonID || !week) {
      return NextResponse.json(
        { error: 'seasonID and week are required' },
        { status: 400 },
      );
    }

    const matchups = await getMatchupsForWeek(seasonID, week, source || 'lineups');

    const matches = matchups.map((m) => ({
      home: m.homeTeamName,
      away: m.awayTeamName,
      lanes: `Lanes ${m.matchNumber * 2 - 1}/${m.matchNumber * 2}`,
      homeCount: m.bowlers.filter((b) => b.side === 'home' && b.name).length,
      awayCount: m.bowlers.filter((b) => b.side === 'away' && b.name).length,
      bowlers: m.bowlers.map((b) => ({
        name: b.name,
        side: b.side,
        avg: b.incomingAvg,
        hcp: b.handicap,
        source: b.rosterSource || null,
      })),
    }));

    return NextResponse.json({ matches });
  } catch (err) {
    console.error('Preview error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load preview' },
      { status: 500 },
    );
  }
}
