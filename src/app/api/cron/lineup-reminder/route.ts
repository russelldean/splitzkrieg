/**
 * GET /api/cron/lineup-reminder
 *
 * Runs twice a week (see vercel.json): Friday for the first ask, Monday for the
 * last call. Which pass it is comes from the match date, not from the schedule
 * that triggered it, so a shifted bowling night cannot produce a last call three
 * days early.
 *
 * Secured with CRON_SECRET.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getUpcomingMatchDate } from '@/lib/admin/scoresheets';
import { reminderPlan, isDuplicate } from '@/lib/admin/reminder-window';
import { actionKeys, automationEnabled, readSettings, recordAction } from '@/lib/admin/action-log';
import { findMissingLineups, sendReminders } from '@/lib/admin/lineup-reminders';

export const dynamic = 'force-dynamic';

/** Today's date in league time, as 'YYYY-MM-DD'. */
function todayET(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export async function GET(request: NextRequest) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = await getDb();

    const seasonRes = await db.request().query<{ seasonID: number; displayName: string }>(
      `SELECT TOP 1 seasonID, displayName
       FROM seasons
       ORDER BY year DESC, CASE period WHEN 'Fall' THEN 2 ELSE 1 END DESC`,
    );
    const season = seasonRes.recordset[0];
    if (!season) return NextResponse.json({ message: 'No active season found', sent: 0 });

    const pwRes = await db
      .request()
      .query<{ settingValue: string }>(
        `SELECT settingValue FROM leagueSettings WHERE settingKey = 'publishedWeek'`,
      );
    const publishedWeek = parseInt(pwRes.recordset[0]?.settingValue ?? '0', 10) || 0;
    const week = publishedWeek + 1;

    // Handles split weeks by choosing the upcoming night. Do not replace with
    // SELECT TOP 1, which has no ORDER BY and picks arbitrarily.
    const matchDate = await getUpcomingMatchDate(season.seasonID, week);

    const plan = reminderPlan({
      nowET: todayET(),
      matchDate,
      enabled: await automationEnabled(),
    });

    if (!plan.eligible) {
      return NextResponse.json({
        season: season.displayName,
        week,
        pass: plan.pass,
        sent: 0,
        message: `Skipping: ${plan.reason}`,
      });
    }

    const key = actionKeys.remind(season.seasonID, week, plan.pass);
    const lastSentAt = (await readSettings([key]))[key];
    if (isDuplicate(lastSentAt, new Date().toISOString())) {
      return NextResponse.json({
        season: season.displayName,
        week,
        pass: plan.pass,
        sent: 0,
        message: `Skipping: already sent at ${lastSentAt}`,
      });
    }

    const missing = await findMissingLineups(season.seasonID, week);
    if (missing.length === 0) {
      return NextResponse.json({
        season: season.displayName,
        week,
        pass: plan.pass,
        sent: 0,
        message: `All teams submitted for Week ${week}`,
      });
    }

    const outcome = await sendReminders(missing, plan.pass, week);
    if (outcome.sent > 0) await recordAction(key);

    console.info(
      `Cron lineup-reminder: week ${week}, pass ${plan.pass}, sent ${outcome.sent}, skipped ${outcome.skipped}, errors ${outcome.errors.length}`,
    );

    return NextResponse.json({
      season: season.displayName,
      week,
      pass: plan.pass,
      sent: outcome.sent,
      skipped: outcome.skipped,
      noEmail: outcome.noEmail,
      errors: outcome.errors.length > 0 ? outcome.errors : undefined,
    });
  } catch (err) {
    console.error('Cron lineup-reminder error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Cron failed' },
      { status: 500 },
    );
  }
}
