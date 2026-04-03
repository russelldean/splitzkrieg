/**
 * GET /api/cron/lineup-reminder
 * Vercel cron job - runs every Friday at 10am ET.
 * Only sends reminders if there's a match scheduled within the next
 * 3 days (covers Friday before a Monday bowling night).
 * Emails captains who haven't submitted lineups for the upcoming week.
 *
 * Secured via CRON_SECRET header check.
 */

import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import { Resend } from 'resend';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = await getDb();

    // Get current season
    const seasonResult = await db.request().query<{
      seasonID: number;
      displayName: string;
    }>(
      `SELECT TOP 1 seasonID, displayName
       FROM seasons
       ORDER BY year DESC, CASE period WHEN 'Fall' THEN 2 ELSE 1 END DESC`,
    );
    const season = seasonResult.recordset[0];
    if (!season) {
      return NextResponse.json({ message: 'No active season found' });
    }

    // Get published week to determine next week
    let publishedWeek = 0;
    try {
      const lsResult = await db
        .request()
        .query<{ settingValue: string }>(
          `SELECT settingValue FROM leagueSettings WHERE settingKey = 'publishedWeek'`,
        );
      if (lsResult.recordset[0]) {
        publishedWeek = parseInt(lsResult.recordset[0].settingValue, 10) || 0;
      }
    } catch {
      // leagueSettings might not exist
    }

    const nextWeek = publishedWeek + 1;

    // Check if there's a match scheduled within the next 3 days
    // (Friday cron -> Monday bowling night = 3 days)
    const matchCheck = await db
      .request()
      .input('seasonID', sql.Int, season.seasonID)
      .input('week', sql.Int, nextWeek)
      .query<{ matchDate: Date }>(`
        SELECT TOP 1 matchDate FROM schedule
        WHERE seasonID = @seasonID AND week = @week AND matchDate IS NOT NULL
      `);

    if (matchCheck.recordset.length === 0) {
      return NextResponse.json({
        message: `No match scheduled for Week ${nextWeek}, skipping`,
        sent: 0,
      });
    }

    const matchDate = matchCheck.recordset[0].matchDate;
    const now = new Date();
    const daysUntilMatch = (matchDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

    if (daysUntilMatch < 0 || daysUntilMatch > 4) {
      return NextResponse.json({
        message: `Next match is ${matchDate.toISOString().slice(0, 10)} (${Math.round(daysUntilMatch)} days away), skipping`,
        sent: 0,
      });
    }

    // Get teams that haven't submitted, with captain email
    const missing = await db
      .request()
      .input('seasonID', sql.Int, season.seasonID)
      .input('week', sql.Int, nextWeek)
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

    if (missing.recordset.length === 0) {
      return NextResponse.json({
        message: `All teams submitted for Week ${nextWeek}`,
        sent: 0,
      });
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 500 });
    }

    const resend = new Resend(apiKey);
    const fromAddress =
      process.env.RECAP_FROM_ADDRESS || 'Splitzkrieg <noreply@splitzkrieg.com>';

    let sent = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const team of missing.recordset) {
      if (!team.email) {
        skipped++;
        continue;
      }

      const name = team.bowlerName || 'Captain';

      // Resend free tier: max 2 emails/second — pace sends
      if (sent > 0) await new Promise(r => setTimeout(r, 600));

      try {
        await resend.emails.send({
          from: fromAddress,
          to: team.email,
          subject: `Lineup Reminder - Week ${nextWeek}`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; padding: 32px;">
              <h2 style="color: #1a2744; margin-bottom: 16px;">Hey ${name}!</h2>
              <p style="color: #333; line-height: 1.6; margin-bottom: 24px;">
                Please submit your Week ${nextWeek} lineup for <strong>${team.teamName}</strong> as soon as you are able. After submitted, you will still be able to edit your lineup on the site until we print scoresheets Monday afternoon.
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
        errors.push(`${team.teamName}: ${err instanceof Error ? err.message : 'failed'}`);
      }
    }

    console.log(
      `Cron lineup-reminder: Week ${nextWeek}, sent ${sent}, skipped ${skipped}, errors ${errors.length}`,
    );

    return NextResponse.json({
      season: season.displayName,
      week: nextWeek,
      sent,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    console.error('Cron lineup-reminder error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Cron failed' },
      { status: 500 },
    );
  }
}
