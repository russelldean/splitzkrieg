/**
 * GET /api/lineup/scoresheets
 * Public endpoint to download the scoresheet PDF for the current week.
 * No admin auth required — uses the same season/week as the lineup page.
 */

import { NextResponse } from 'next/server';
import { actionKeys, recordAction } from '@/lib/admin/action-log';
import { getCurrentLineupContext } from '@/lib/admin/lineups';
import { getMatchupsForWeek, generateScoresheet, getUpcomingMatchDate } from '@/lib/admin/scoresheets';

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
    // Split-phase weeks span two Mondays; print only the upcoming night's matches.
    const printDate = await getUpcomingMatchDate(seasonID, week);
    const matches = await getMatchupsForWeek(seasonID, week, 'lineups', printDate);

    if (matches.length === 0) {
      return NextResponse.json(
        { error: 'No matchups found for this week' },
        { status: 404 },
      );
    }

    const doc = await generateScoresheet(matches);
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

    // The admin page is not the only way these get printed -- this public link on
    // /lineup is the one an assistant (or Russ) actually clicks, and it used to
    // record nothing, so the pre-night board's Scoresheets row read "not recorded"
    // every week of its life. Same PDF, same meaning: the sheets exist for this week.
    await recordAction(actionKeys.scoresheets(seasonID, week));

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="scoresheets-w${week}${printDate ? '-' + printDate : ''}.pdf"`,
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
