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
import {
  findMissingLineups,
  sendReminders,
  REMINDER_BUDGET_MS,
} from '@/lib/admin/lineup-reminders';
import { todayET } from '@/lib/admin/clock';

export const dynamic = 'force-dynamic';

// Mailing the league costs at least 600ms a head in pacing, so this run does
// not fit in the platform default. Must be a literal; Next reads it statically.
export const maxDuration = 60;

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

    // The key is stamped from inside the loop, on the first successful send,
    // not out here on the way back. A run killed partway used to leave no
    // record at all, so the next tick mailed everyone who had already been
    // reached a second time.
    const outcome = await sendReminders(missing, plan.pass, week, {
      budgetMs: REMINDER_BUDGET_MS,
      onFirstSend: () => recordAction(key),
    });

    console.info(
      `Cron lineup-reminder: week ${week}, pass ${plan.pass}, sent ${outcome.sent}, skipped ${outcome.skipped}, errors ${outcome.errors.length}${outcome.stoppedEarly ? `, STOPPED EARLY with ${outcome.remaining} unreached` : ''}`,
    );

    // Every recipient failed, so report it as an error status. A 200 here would
    // make a total outage indistinguishable from a deliberate skip to anything
    // watching the cron.
    const status = outcome.sent === 0 && outcome.errors.length > 0 ? 502 : 200;

    return NextResponse.json(
      {
        season: season.displayName,
        week,
        pass: plan.pass,
        sent: outcome.sent,
        skipped: outcome.skipped,
        noEmail: outcome.noEmail,
        errors: outcome.errors.length > 0 ? outcome.errors : undefined,
        stoppedEarly: outcome.stoppedEarly || undefined,
        remaining: outcome.remaining || undefined,
        message: outcome.stoppedEarly
          ? `Ran out of time after ${outcome.sent}; ${outcome.remaining} never reached for week ${week}`
          : outcome.sent > 0
            ? `Sent ${outcome.sent} for week ${week}`
            : 'Attempted, nothing sent',
      },
      { status },
    );
  } catch (err) {
    console.error('Cron lineup-reminder error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Cron failed' },
      { status: 500 },
    );
  }
}
