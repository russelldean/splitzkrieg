/**
 * POST /api/evillair/playoffs/scoresheets
 * Generate a combined PDF scoresheet for one playoff round.
 * Body: { seasonID, round: 1 | 2, matchDate: string (e.g. "May 11, 2026") }
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/auth';
import { getPlayoffScoresheetMatches, generateScoresheet } from '@/lib/admin/scoresheets';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);
  } catch {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { seasonID, round, matchDate } = body as {
      seasonID: number;
      round: 1 | 2;
      matchDate: string;
    };

    if (!seasonID || !round || !matchDate) {
      return NextResponse.json(
        { error: 'seasonID, round, and matchDate are required' },
        { status: 400 },
      );
    }
    if (round !== 1 && round !== 2) {
      return NextResponse.json({ error: 'round must be 1 or 2' }, { status: 400 });
    }

    const matches = await getPlayoffScoresheetMatches(seasonID, round, matchDate);
    if (matches.length === 0) {
      return NextResponse.json(
        { error: 'No playoff matchups found. Save semifinals and individual fields first.' },
        { status: 404 },
      );
    }

    const doc = await generateScoresheet(matches);
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="playoff-scoresheets-s${seasonID}-r${round}.pdf"`,
        'Content-Length': String(pdfBuffer.length),
      },
    });
  } catch (err) {
    console.error('playoff scoresheet error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to generate scoresheets' },
      { status: 500 },
    );
  }
}
