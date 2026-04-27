/**
 * POST /api/evillair/scoresheets
 * Generate a PDF scoresheet for the given season and week.
 * Returns binary PDF response for browser download.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/auth';
import { getMatchupsForWeek, generateScoresheet } from '@/lib/admin/scoresheets';

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

    const matches = await getMatchupsForWeek(seasonID, week, source || 'lineups');

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
        'Content-Disposition': `attachment; filename="scoresheets-s${seasonID}-w${week}.pdf"`,
        'Content-Length': String(pdfBuffer.length),
      },
    });
  } catch (err) {
    console.error('Scoresheet generation error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to generate scoresheets' },
      { status: 500 },
    );
  }
}
