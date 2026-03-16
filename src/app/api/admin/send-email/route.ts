/**
 * POST /api/admin/send-email
 * Send a custom email to captains or the whole league.
 * Body: { to: 'captains' | 'league', subject, body }
 *
 * Captain emails come from bowlers.email via teams.captainBowlerID.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { requireAdmin } from '@/lib/admin/auth';
import { getDb, withRetry } from '@/lib/db';

export const dynamic = 'force-dynamic';

async function getCaptainEmails(): Promise<
  Array<{ teamName: string; bowlerName: string; email: string }>
> {
  const db = await getDb();
  const result = await withRetry(
    () =>
      db.request().query(`
        SELECT t.teamName, b.bowlerName, b.email
        FROM teams t
        JOIN bowlers b ON t.captainBowlerID = b.bowlerID
        WHERE b.email IS NOT NULL
        ORDER BY t.teamName
      `),
    'getCaptainEmails',
  );
  return result.recordset;
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);
  } catch {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  try {
    const { subject, body, testEmail } = await request.json();

    if (!subject || !body) {
      return NextResponse.json(
        { error: 'subject and body are required' },
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

    // If testEmail provided, send only to that address
    let emails: string[];
    if (testEmail) {
      emails = [testEmail];
    } else {
      const captains = await getCaptainEmails();
      if (captains.length === 0) {
        return NextResponse.json(
          { error: 'No captain emails on file. Add emails on the Captains page.' },
          { status: 400 },
        );
      }
      emails = [...new Set(captains.map((c) => c.email))];
    }
    const resend = new Resend(apiKey);
    const fromAddress =
      process.env.RECAP_FROM_ADDRESS || 'Splitzkrieg <onboarding@resend.dev>';

    let sent = 0;
    const errors: string[] = [];

    for (const email of emails) {
      try {
        await resend.emails.send({
          from: fromAddress,
          to: email,
          subject,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
              ${body
                .split('\n')
                .map((line: string) =>
                  line.trim()
                    ? `<p style="color: #333; line-height: 1.6; margin: 0 0 12px 0;">${line}</p>`
                    : '<br/>',
                )
                .join('')}
              <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
              <p style="color: #999; font-size: 12px;">Sent from Splitzkrieg Admin</p>
            </div>
          `,
        });
        sent++;
      } catch (err) {
        errors.push(`${email}: ${err instanceof Error ? err.message : 'failed'}`);
      }
    }

    return NextResponse.json({
      sent,
      total: emails.length,
      errors: errors.length > 0 ? errors : undefined,
      message: `Sent to ${sent} of ${emails.length} recipient${emails.length !== 1 ? 's' : ''}`,
    });
  } catch (err) {
    console.error('Send email error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to send email' },
      { status: 500 },
    );
  }
}
