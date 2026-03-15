import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { requireAdmin, signToken } from '@/lib/admin/auth';
import { getDb } from '@/lib/db';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    await requireAdmin(request);
  } catch {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  try {
    const { teamID, captainName, captainEmail } = await request.json();

    if (!teamID || !captainName || !captainEmail) {
      return NextResponse.json(
        { error: 'teamID, captainName, and captainEmail are required' },
        { status: 400 },
      );
    }

    // Sign a long-lived captain token (90 days)
    const token = await signToken(
      { role: 'captain', teamID, captainName },
      '90d',
    );

    // Store in captainSessions for revocation tracking
    const db = await getDb();
    await db
      .request()
      .input('teamID', teamID)
      .input('captainName', captainName)
      .input('captainEmail', captainEmail)
      .input('token', token)
      .query(
        `INSERT INTO captainSessions (teamID, captainName, captainEmail, token, createdAt, expiresAt, revoked)
         VALUES (@teamID, @captainName, @captainEmail, @token, GETDATE(), DATEADD(day, 90, GETDATE()), 0)`,
      );

    // Send magic link email via Resend
    const magicLink = `https://splitzkrieg.com/lineup/login?token=${token}`;

    if (process.env.RESEND_API_KEY) {
      await resend.emails.send({
        from: 'Splitzkrieg <onboarding@resend.dev>',
        to: captainEmail,
        subject: 'Your Splitzkrieg Lineup Link',
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; padding: 32px;">
            <h2 style="color: #1a2744; margin-bottom: 16px;">Hey ${captainName}!</h2>
            <p style="color: #333; line-height: 1.6; margin-bottom: 24px;">
              Click the button below to submit your lineup for Splitzkrieg bowling league.
              This link will work for 90 days, so bookmark it or keep this email handy.
            </p>
            <a href="${magicLink}"
               style="display: inline-block; background-color: #c83232; color: #fff; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-weight: 600; font-size: 16px;">
              Submit Your Lineup
            </a>
            <p style="color: #999; font-size: 13px; margin-top: 24px; line-height: 1.5;">
              If the button doesn't work, copy and paste this URL into your browser:<br/>
              <a href="${magicLink}" style="color: #c83232; word-break: break-all;">${magicLink}</a>
            </p>
          </div>
        `,
      });
    }

    return NextResponse.json({ sent: true });
  } catch (err) {
    console.error('Magic link error:', err);
    return NextResponse.json(
      { error: 'Failed to send magic link' },
      { status: 500 },
    );
  }
}
