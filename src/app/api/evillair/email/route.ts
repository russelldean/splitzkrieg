/**
 * POST /api/evillair/email
 * Send a weekly recap email via Resend.
 * Refactored from scripts/send-recap-email.mjs for admin UI use.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import sql from 'mssql';
import { requireAdmin } from '@/lib/admin/auth';
import { getDb } from '@/lib/db';
import { getAllSeasonNavList } from '@/lib/queries';

export const dynamic = 'force-dynamic';

interface EmailRequestBody {
  seasonID: number;
  week: number;
  seasonRoman?: string;
  subject?: string;
  teaser?: string;
  to?: string;
  blogSlug?: string;
}

/**
 * Convert a season ID to its roman numeral display name.
 * Falls back to the ID as a string if conversion is not needed.
 */
function seasonToRoman(seasonID: number): string {
  // The league uses roman numerals for season names
  const romanNumerals: [number, string][] = [
    [40, 'XL'], [30, 'XXX'], [20, 'XX'], [10, 'X'],
    [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ];
  let result = '';
  let remaining = seasonID;
  for (const [value, numeral] of romanNumerals) {
    while (remaining >= value) {
      result += numeral;
      remaining -= value;
    }
  }
  return result;
}

function buildEmailHTML(
  subject: string,
  teaser: string,
  blogUrl: string,
): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f5f0e8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f0e8; padding: 20px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%;">
          <!-- Header -->
          <tr>
            <td style="background-color: #1a1f3d; padding: 24px 32px; text-align: center;">
              <h1 style="margin: 0; color: #f5f0e8; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">
                Splitzkrieg
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background-color: #ffffff; padding: 32px;">
              <h2 style="margin: 0 0 16px; color: #1a1f3d; font-size: 22px; font-weight: 600;">
                ${subject}
              </h2>
              <p style="margin: 0 0 24px; color: #333; font-size: 16px; line-height: 1.6;">
                ${teaser}
              </p>
              <table cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                <tr>
                  <td style="background-color: #c41e3a; border-radius: 6px;">
                    <a href="${blogUrl}"
                       style="display: inline-block; padding: 14px 32px; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600;">
                      Read the Full Recap
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f5f0e8; padding: 20px 32px; text-align: center;">
              <p style="margin: 0; color: #888; font-size: 13px; line-height: 1.5;">
                You're receiving this because you're in the Splitzkrieg bowling league.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);
  } catch {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'RESEND_API_KEY not configured' },
      { status: 500 },
    );
  }

  try {
    const body: EmailRequestBody = await request.json();
    const { seasonID, week, to } = body;

    if (!seasonID || !week) {
      return NextResponse.json(
        { error: 'seasonID and week are required' },
        { status: 400 },
      );
    }

    const seasonRoman = body.seasonRoman || seasonToRoman(seasonID);
    const subject = body.subject || `Week ${week} Recap is Live!`;
    const teaser =
      body.teaser ||
      `This week's scores are in. Check out who topped the charts and who made their mark.`;
    const slug =
      body.blogSlug ||
      `season-${seasonRoman.toLowerCase()}-week-${week}-recap`;
    // Recaps live on the week page now. Fall back to the blog URL if the season
    // slug cannot be resolved. That path redirects to the week page, but only for
    // a post published with both seasonSlug and week set; a recap always has them.
    const seasonSlug = (await getAllSeasonNavList()).find(
      (s) => s.seasonID === seasonID,
    )?.slug;
    const blogUrl = seasonSlug
      ? `https://splitzkrieg.com/week/${seasonSlug}/${week}`
      : `https://splitzkrieg.com/blog/${slug}`;

    const html = buildEmailHTML(subject, teaser, blogUrl);

    const toAddress = to || 'splitzkrieg-bowlers@googlegroups.com';
    const fromAddress =
      process.env.RECAP_FROM_ADDRESS || 'Splitzkrieg <noreply@splitzkrieg.com>';
    const replyTo = process.env.COMMISSIONER_EMAIL || undefined;

    const resend = new Resend(apiKey);
    const errors: string[] = [];
    let sent = 0;

    try {
      const { data, error } = await resend.emails.send({
        from: fromAddress,
        to: [toAddress],
        subject,
        html,
        ...(replyTo ? { replyTo } : {}),
      });

      if (error) {
        errors.push(
          `Resend error: ${typeof error === 'object' ? JSON.stringify(error) : String(error)}`,
        );
      } else if (data) {
        sent = 1;
      }
    } catch (sendErr) {
      errors.push(
        sendErr instanceof Error ? sendErr.message : 'Unknown send error',
      );
    }

    // Record the send so the weekly board can DERIVE that the email went out
    // rather than relying on a checkbox. Only on success, and never fatal: a
    // logging failure must not report a sent email as failed.
    if (sent > 0) {
      try {
        const db = await getDb();
        await db
          .request()
          .input('key', sql.VarChar(50), `emailSent-s${seasonID}-w${week}`)
          .input('value', sql.VarChar(255), new Date().toISOString())
          .query(`
            MERGE leagueSettings AS target
            USING (SELECT @key AS settingKey) AS source
            ON target.settingKey = source.settingKey
            WHEN MATCHED THEN UPDATE SET settingValue = @value
            WHEN NOT MATCHED THEN INSERT (settingKey, settingValue) VALUES (@key, @value);
          `);
      } catch (logErr) {
        console.error('[EMAIL_LOG] send succeeded but recording it failed:', logErr);
      }
    }

    return NextResponse.json({ sent, errors });
  } catch (err) {
    console.error('Email error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to send email' },
      { status: 500 },
    );
  }
}
