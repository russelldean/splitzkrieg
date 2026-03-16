/**
 * POST /api/admin/remind-captains
 * Send lineup reminder emails to captains who haven't submitted yet.
 * Uses bowlers.email via teams.captainBowlerID for contact info.
 */

import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import { Resend } from 'resend';
import { requireAdmin } from '@/lib/admin/auth';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);
  } catch {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  try {
    const { seasonID, week } = await request.json();
    if (!seasonID || !week) {
      return NextResponse.json(
        { error: 'seasonID and week are required' },
        { status: 400 },
      );
    }

    const db = await getDb();

    // Teams that haven't submitted, with captain email from bowlers table
    const result = await db
      .request()
      .input('seasonID', sql.Int, seasonID)
      .input('week', sql.Int, week)
      .query<{
        teamID: number;
        teamName: string;
        bowlerName: string | null;
        email: string | null;
      }>(`
        SELECT DISTINCT t.teamID, t.teamName, b.bowlerName, b.email
        FROM schedule sch
        JOIN teams t ON t.teamID = sch.team1ID OR t.teamID = sch.team2ID
        LEFT JOIN bowlers b ON t.captainBowlerID = b.bowlerID
        WHERE sch.seasonID = @seasonID
          AND sch.team1ID IS NOT NULL AND sch.team2ID IS NOT NULL
          AND t.teamID NOT IN (
            SELECT teamID FROM lineupSubmissions
            WHERE seasonID = @seasonID AND week = @week
          )
        ORDER BY t.teamName
      `);

    if (result.recordset.length === 0) {
      return NextResponse.json({ sent: 0, skipped: 0, message: 'All teams have submitted!' });
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'RESEND_API_KEY not configured' },
        { status: 500 },
      );
    }

    const resend = new Resend(apiKey);
    const fromAddress =
      process.env.RECAP_FROM_ADDRESS || 'Splitzkrieg <onboarding@resend.dev>';

    let sent = 0;
    let skipped = 0;
    const noEmail: string[] = [];
    const errors: string[] = [];

    for (const team of result.recordset) {
      if (!team.email) {
        noEmail.push(team.teamName);
        skipped++;
        continue;
      }

      const name = team.bowlerName || 'Captain';

      try {
        await resend.emails.send({
          from: fromAddress,
          to: team.email,
          subject: `Lineup Reminder - Week ${week}`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; padding: 32px;">
              <h2 style="color: #1a2744; margin-bottom: 16px;">Hey ${name}!</h2>
              <p style="color: #333; line-height: 1.6; margin-bottom: 24px;">
                Please submit your Week ${week} lineup for <strong>${team.teamName}</strong> as soon as you are able. After submitted, you will still be able to edit your lineup on the site until we print scoresheets Monday afternoon.
              </p>
              <a href="https://splitzkrieg.com/lineup"
                 style="display: inline-block; background-color: #c83232; color: #fff; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-weight: 600; font-size: 16px;">
                Submit Lineup
              </a>
              <p style="color: #999; font-size: 13px; margin-top: 24px;">
                If you've already submitted, you can ignore this.
              </p>
            </div>
          `,
        });
        sent++;
      } catch (err) {
        errors.push(`${team.teamName}: ${err instanceof Error ? err.message : 'send failed'}`);
      }
    }

    return NextResponse.json({
      sent,
      skipped,
      noEmail,
      errors: errors.length > 0 ? errors : undefined,
      message: `Sent ${sent} reminder${sent !== 1 ? 's' : ''}${skipped > 0 ? `, ${skipped} skipped (no email)` : ''}`,
    });
  } catch (err) {
    console.error('Remind captains error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to send reminders' },
      { status: 500 },
    );
  }
}
