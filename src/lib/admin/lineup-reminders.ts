/**
 * Who still owes a lineup, and what to say to them.
 *
 * The cron and the manual admin button both used to carry their own copy of
 * this query and this HTML. They have now converged here so the week filter fix
 * below cannot be applied to one and forgotten in the other.
 */

import sql from 'mssql';
import { Resend } from 'resend';
import { getDb } from '@/lib/db';
import type { ReminderPass } from './reminder-window';

export interface ReminderRecipient {
  teamID: number;
  teamName: string;
  bowlerName: string | null;
  email: string | null;
}

/**
 * Teams scheduled in this week that have not submitted a lineup.
 *
 * `AND sch.week = @week` is the fix. Without it the query collected every team
 * appearing anywhere in the season's schedule, then subtracted this week's
 * submitters, so a team not playing this week was still mailed.
 *
 * Verified against season 36 weeks 3 to 5 on 2026-08-20: the filter changes
 * nothing today, because all 20 teams are scheduled every week, and it never
 * ADDS a recipient. It matters the first time a team has a bye. Note that a
 * split week is not such a case: both nights share one week number and differ
 * only by matchDate, so the old query was never mailing the wrong night.
 */
export async function findMissingLineups(
  seasonID: number,
  week: number,
): Promise<ReminderRecipient[]> {
  const db = await getDb();
  const res = await db
    .request()
    .input('seasonID', sql.Int, seasonID)
    .input('week', sql.Int, week)
    .query<ReminderRecipient>(`
      SELECT DISTINCT t.teamID, t.teamName, b.bowlerName, b.email
      FROM schedule sch
      JOIN teams t ON t.teamID = sch.team1ID OR t.teamID = sch.team2ID
      LEFT JOIN bowlers b ON t.captainBowlerID = b.bowlerID
      WHERE sch.seasonID = @seasonID
        AND sch.week = @week
        AND sch.team1ID IS NOT NULL AND sch.team2ID IS NOT NULL
        AND t.teamID NOT IN (
          SELECT teamID FROM lineupSubmissions
          WHERE seasonID = @seasonID AND week = @week
        )
      ORDER BY t.teamName
    `);
  return res.recordset;
}

/** How many teams are scheduled to bowl this week. Denominator for the board. */
export async function countScheduledTeams(seasonID: number, week: number): Promise<number> {
  const db = await getDb();
  const res = await db
    .request()
    .input('seasonID', sql.Int, seasonID)
    .input('week', sql.Int, week)
    .query<{ n: number }>(`
      SELECT COUNT(DISTINCT teamID) AS n FROM (
        SELECT team1ID AS teamID FROM schedule WHERE seasonID = @seasonID AND week = @week
        UNION ALL
        SELECT team2ID FROM schedule WHERE seasonID = @seasonID AND week = @week
      ) x WHERE teamID IS NOT NULL
    `);
  return res.recordset[0]?.n ?? 0;
}

const BUTTON =
  'display: inline-block; background-color: #c83232; color: #fff; text-decoration: none; ' +
  'padding: 14px 28px; border-radius: 6px; font-weight: 600; font-size: 16px;';
const WRAP =
  "font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; " +
  'max-width: 500px; margin: 0 auto; padding: 32px;';

/** Subject and body for one recipient. The two passes read differently on purpose. */
export function reminderEmail(opts: {
  pass: ReminderPass;
  week: number;
  teamName: string;
  captainName: string;
}): { subject: string; html: string } {
  const { pass, week, teamName, captainName } = opts;

  const subject =
    pass === 'lastcall'
      ? `Last call - Week ${week} lineup needed today`
      : `Lineup Reminder - Week ${week}`;

  const body =
    pass === 'lastcall'
      ? `We print scoresheets this afternoon and we still do not have a Week ${week} lineup for <strong>${teamName}</strong>. Send it over as soon as you can and it will make the sheets.`
      : `Please submit your Week ${week} lineup for <strong>${teamName}</strong> as soon as you are able. After submitted, you will still be able to edit your lineup on the site until we print scoresheets Monday afternoon.`;

  return {
    subject,
    html: `
      <div style="${WRAP}">
        <h2 style="color: #1a2744; margin-bottom: 16px;">Hey ${captainName}!</h2>
        <p style="color: #333; line-height: 1.6; margin-bottom: 24px;">${body}</p>
        <a href="https://splitzkrieg.com/lineup" style="${BUTTON}">Submit Lineup</a>
        <p style="color: #999; font-size: 13px; margin-top: 24px;">
          If you've already submitted, you can ignore this.
        </p>
      </div>
    `,
  };
}

export interface SendOutcome {
  sent: number;
  skipped: number;
  noEmail: string[];
  errors: string[];
  /** True when the budget ran out before every recipient was reached. */
  stoppedEarly: boolean;
  /** Recipients never attempted, because the budget ran out first. */
  remaining: number;
  /** Names of those recipients, so a caller can re-send to just them. */
  unreached: string[];
}

export interface SendOptions {
  /**
   * Called once, right after the first successful send. This is where the
   * caller stamps its dedupe key.
   *
   * It has to happen mid-loop rather than after it. Mailing 41 teams costs at
   * least 41 x 600ms of pacing, so the run outlives a short function timeout;
   * a caller that recorded only on return left no trace when it was killed,
   * and the next cron tick mailed the whole league a second time. Stamping on
   * the first success means an interrupted run is remembered as having
   * happened. Some captains then miss a reminder, which is the better failure.
   *
   * Throwing here is swallowed: failing to record must not stop the mail.
   */
  onFirstSend?: () => Promise<void>;
  /**
   * Wall-clock budget for the whole loop. When the next send would not fit,
   * the loop stops and reports `remaining` instead of being killed with the
   * outcome unreported. Omit for no limit.
   */
  budgetMs?: number;
  /** Injectable for tests. */
  now?: () => number;
  /** Injectable for tests. */
  sleep?: (ms: number) => Promise<void>;
}

/** Resend's free tier caps at 2 emails a second. */
const PACE_MS = 600;

/**
 * How long the routes give the loop before they cut it off.
 *
 * Both reminder routes declare `maxDuration = 60`. Pacing alone costs 600ms a
 * head, so a 20-team league is already ~12s of pure waiting and a full 41-team
 * week is ~25s before Resend's own latency. Ten seconds of the sixty are held
 * back so the route can record and answer rather than being killed. The
 * literal 60 has to stay written out in each route: Next reads maxDuration
 * statically and will not follow an imported constant.
 */
export const REMINDER_BUDGET_MS = 50_000;

/**
 * Mail each recipient, paced for Resend's rate cap.
 *
 * Not transactional: it can stop partway. See `onFirstSend` and `budgetMs` for
 * how a caller keeps a partial run from turning into a duplicate blast.
 */
export async function sendReminders(
  recipients: ReminderRecipient[],
  pass: ReminderPass,
  week: number,
  options: SendOptions = {},
): Promise<SendOutcome> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY not configured');

  const {
    onFirstSend,
    budgetMs,
    now = () => Date.now(),
    sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms)),
  } = options;

  const resend = new Resend(apiKey);
  const from = process.env.RECAP_FROM_ADDRESS || 'Splitzkrieg <noreply@splitzkrieg.com>';

  const outcome: SendOutcome = {
    sent: 0,
    skipped: 0,
    noEmail: [],
    errors: [],
    stoppedEarly: false,
    remaining: 0,
    unreached: [],
  };

  const startedAt = now();
  let attempts = 0;
  let claimed = false;

  for (let i = 0; i < recipients.length; i++) {
    const team = recipients[i];

    if (!team.email) {
      outcome.noEmail.push(team.teamName);
      outcome.skipped++;
      continue;
    }

    // Stop on our own terms while there is still time to return a response.
    // Budget is checked before the pacing delay, since that delay is the bulk
    // of what the next recipient costs.
    if (budgetMs !== undefined && now() - startedAt >= budgetMs) {
      const left = recipients.slice(i);
      outcome.stoppedEarly = true;
      outcome.remaining = left.length;
      outcome.unreached = left.map((t) => t.teamName);
      break;
    }

    // Paced on ATTEMPTS rather than successes: gating on successes meant a
    // failed send left the counter at zero, so the next send fired with no
    // delay and a run of failures defeated the limit entirely.
    if (attempts > 0) await sleep(PACE_MS);
    attempts++;

    const { subject, html } = reminderEmail({
      pass,
      week,
      teamName: team.teamName,
      captainName: team.bowlerName || 'Captain',
    });

    try {
      await resend.emails.send({ from, to: team.email, subject, html });
      outcome.sent++;

      if (!claimed) {
        claimed = true;
        try {
          await onFirstSend?.();
        } catch (err) {
          console.error('[REMINDERS] first send recorded nowhere:', err);
        }
      }
    } catch (err) {
      outcome.errors.push(
        `${team.teamName}: ${err instanceof Error ? err.message : 'send failed'}`,
      );
    }
  }

  return outcome;
}
