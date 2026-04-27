/**
 * POST /api/evillair/scoresheets/email
 * Generate scoresheet PDF and email it as an attachment via Resend.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
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
    const { seasonID, week, source, to } = body as {
      seasonID: number;
      week: number;
      source?: 'lineups' | 'lastweek';
      to: string;
    };

    if (!seasonID || !week) {
      return NextResponse.json(
        { error: 'seasonID and week are required' },
        { status: 400 },
      );
    }

    if (!to || !to.includes('@')) {
      return NextResponse.json(
        { error: 'Valid email address is required' },
        { status: 400 },
      );
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'RESEND_API_KEY not configured' },
        { status: 500 },
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

    const fromAddress =
      process.env.RECAP_FROM_ADDRESS || 'Splitzkrieg <noreply@splitzkrieg.com>';
    const filename = `scoresheets-s${seasonID}-w${week}.pdf`;

    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: fromAddress,
      to: [to],
      subject: `Splitzkrieg Scoresheets - Week ${week}`,
      html: `<p>Scoresheets for Week ${week} attached.</p>`,
      attachments: [
        {
          filename,
          content: pdfBuffer.toString('base64'),
        },
      ],
    });

    if (error) {
      return NextResponse.json(
        { error: `Failed to send: ${typeof error === 'object' ? JSON.stringify(error) : String(error)}` },
        { status: 500 },
      );
    }

    return NextResponse.json({ sent: true, to });
  } catch (err) {
    console.error('Scoresheet email error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to send email' },
      { status: 500 },
    );
  }
}
