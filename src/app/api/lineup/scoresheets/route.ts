/**
 * GET /api/lineup/scoresheets
 * Public endpoint to download the scoresheet PDF for the current week.
 * No admin auth required — uses the same season/week as the lineup page.
 */

import { NextResponse } from 'next/server';
import { getCurrentLineupContext } from '@/lib/admin/lineups';
import { getMatchupsForWeek, generateScoresheet } from '@/lib/admin/scoresheets';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const context = await getCurrentLineupContext();
    if (!context) {
      return NextResponse.json(
        { error: 'No active season found' },
        { status: 404 },
      );
    }

    const { seasonID, nextWeek: week } = context;
    const matches = await getMatchupsForWeek(seasonID, week, 'lineups');

    if (matches.length === 0) {
      return NextResponse.json(
        { error: 'No matchups found for this week' },
        { status: 404 },
      );
    }

    const doc = await generateScoresheet(matches);
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="scoresheets-w${week}.pdf"`,
        'Content-Length': String(pdfBuffer.length),
      },
    });
  } catch (err) {
    console.error('Public scoresheet error:', err);
    return NextResponse.json(
      { error: 'Failed to generate scoresheets' },
      { status: 500 },
    );
  }
}
