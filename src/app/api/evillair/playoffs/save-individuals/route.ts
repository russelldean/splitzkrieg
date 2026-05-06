/**
 * POST /api/evillair/playoffs/save-individuals
 * Save the participant list for one category/round.
 * Body: { seasonID, championshipType, round, bowlerIDs: number[] }
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/auth';
import {
  saveIndividualPlayoffParticipants,
  type ChampionshipType,
} from '@/lib/admin/playoff-admin';

export const dynamic = 'force-dynamic';

const VALID_TYPES: ChampionshipType[] = ['MensScratch', 'WomensScratch', 'Handicap'];

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);
  } catch {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { seasonID, championshipType, round, bowlerIDs } = body as {
      seasonID: number;
      championshipType: ChampionshipType;
      round: 1 | 2;
      bowlerIDs: number[];
    };

    if (!seasonID || !championshipType || !round || !Array.isArray(bowlerIDs)) {
      return NextResponse.json(
        { error: 'seasonID, championshipType, round, and bowlerIDs are required' },
        { status: 400 },
      );
    }

    if (!VALID_TYPES.includes(championshipType)) {
      return NextResponse.json(
        { error: `championshipType must be one of: ${VALID_TYPES.join(', ')}` },
        { status: 400 },
      );
    }

    if (round !== 1 && round !== 2) {
      return NextResponse.json({ error: 'round must be 1 or 2' }, { status: 400 });
    }

    const expectedSize = round === 1 ? 8 : 4;
    if (bowlerIDs.length !== expectedSize) {
      return NextResponse.json(
        { error: `Round ${round} requires exactly ${expectedSize} bowlers` },
        { status: 400 },
      );
    }

    if (bowlerIDs.some(id => !id || typeof id !== 'number')) {
      return NextResponse.json(
        { error: 'All slots must be filled with a bowler' },
        { status: 400 },
      );
    }

    await saveIndividualPlayoffParticipants(seasonID, championshipType, round, bowlerIDs);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('save-individuals error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to save' },
      { status: 500 },
    );
  }
}
