# Lineup Reminder Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Schedule the captain lineup emails for Friday and match day, and replace the last hand-ticked checklist on `/evillair` with a derived board.

**Architecture:** All decision logic lives in pure, unit-tested modules under `src/lib/admin/` with no database or email access. Routes stay thin: they load values, call a pure function, act on the answer, and record what they did. This mirrors `week-status.ts`, which already works this way.

**Tech Stack:** Next.js (App Router), TypeScript, mssql, Resend, Vitest, Vercel Cron.

**Spec:** `docs/superpowers/specs/2026-08-20-lineup-reminder-automation-design.md`

---

## Context you need before starting

Two bugs in `src/app/api/cron/lineup-reminder/route.ts` are the reason this work exists.

1. The route computes time to the match in floating point milliseconds and bails on
   `daysUntilMatch < 0`. `matchDate` is midnight, so a 10am match-day run computes about
   `-0.58` and returns `"skipping"`. It would report success and mail nobody.
2. The recipient query filters `WHERE sch.seasonID = @seasonID` with no
   `AND sch.week = @week`, so it collects every team appearing anywhere in the season's
   schedule minus this week's submitters. Verified 2026-08-20 to be a no-op on current
   data (all 20 teams are scheduled every week) and it never adds a recipient. It matters
   on a bye. Split weeks are NOT affected: both nights share one week number.

`vercel.json` currently has `"crons": []`, so none of this has ever run in production.

**Do not use `SELECT TOP 1 matchDate`.** `getUpcomingMatchDate(seasonID, week)` already
exists in `src/lib/admin/scoresheets.ts:88`, returns a `YYYY-MM-DD` string, and handles
split weeks by choosing the next upcoming date. Four routes already use it.

## File Structure

| File | Responsibility |
| --- | --- |
| `src/lib/admin/reminder-window.ts` (create) | Pure. Should a reminder go out, and which pass is it. |
| `src/lib/admin/reminder-window.test.ts` (create) | Unit tests for the above. |
| `src/lib/admin/action-log.ts` (create) | Key naming plus read/write of the `leagueSettings` action records. |
| `src/lib/admin/lineup-reminders.ts` (create) | Shared recipient query and email copy for both passes. |
| `src/lib/admin/pre-night-status.ts` (create) | Pure. Turns recorded values into board rows. |
| `src/lib/admin/pre-night-status.test.ts` (create) | Unit tests for the above. |
| `src/app/api/cron/lineup-reminder/route.ts` (rewrite) | Thin: resolve, decide, send, record. |
| `src/app/api/evillair/remind-captains/route.ts` (modify) | Use the shared module, record the send. |
| `src/app/api/evillair/lineups/push/route.ts` (modify) | Record a successful push. |
| `src/app/api/evillair/scoresheets/route.ts` (modify) | Record a successful generate. |
| `src/app/api/evillair/pre-night-status/route.ts` (create) | GET board rows, PATCH the automation flag. |
| `src/components/admin/PreNightStatusBoard.tsx` (create) | Renders the rows. |
| `src/app/evillair/(dashboard)/page.tsx` (modify) | Swap ticks for the board, delete dead code. |
| `src/app/api/evillair/dashboard/route.ts` (modify) | Delete the tick read and write. |
| `vercel.json` (modify) | Two cron schedules. |
| `content/updates.ts` (modify) | Changelog entry. |

---

### Task 1: The reminder window (pure)

**Files:**
- Create: `src/lib/admin/reminder-window.ts`
- Test: `src/lib/admin/reminder-window.test.ts`

The caller needs the pass before it can look up that pass's record, so this splits into
two functions rather than one. `reminderPlan` decides eligibility and pass from dates
alone; `isDuplicate` then answers the dedupe question once the record is loaded.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/admin/reminder-window.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { reminderPlan, isDuplicate, daysUntil, DEDUPE_HOURS } from './reminder-window';

describe('daysUntil', () => {
  it('counts whole calendar days forward', () => {
    expect(daysUntil('2026-08-21', '2026-08-24')).toBe(3);
  });

  it('is zero on the match day itself', () => {
    expect(daysUntil('2026-08-24', '2026-08-24')).toBe(0);
  });

  it('is negative after the match', () => {
    expect(daysUntil('2026-08-25', '2026-08-24')).toBe(-1);
  });

  it('does not drift across a DST boundary', () => {
    // DST ends 2026-11-01. Nov 2 is week 9.
    expect(daysUntil('2026-10-30', '2026-11-02')).toBe(3);
  });
});

describe('reminderPlan', () => {
  const base = { nowET: '2026-08-21', matchDate: '2026-08-24', enabled: true };

  it('sends the first ask on the Friday before', () => {
    const p = reminderPlan(base);
    expect(p.eligible).toBe(true);
    expect(p.pass).toBe('reminder');
  });

  it('sends the last call on match day', () => {
    // Regression: the old guard computed a negative float here and skipped,
    // so a Monday cron reported success and mailed nobody.
    const p = reminderPlan({ ...base, nowET: '2026-08-24' });
    expect(p.eligible).toBe(true);
    expect(p.pass).toBe('lastcall');
  });

  it('skips once the match is in the past', () => {
    const p = reminderPlan({ ...base, nowET: '2026-08-25' });
    expect(p.eligible).toBe(false);
    expect(p.reason).toMatch(/past/i);
  });

  it('skips when the match is too far out', () => {
    const p = reminderPlan({ ...base, nowET: '2026-08-18' });
    expect(p.eligible).toBe(false);
    expect(p.reason).toMatch(/early/i);
  });

  it('skips when the week has no scheduled match', () => {
    const p = reminderPlan({ ...base, matchDate: null });
    expect(p.eligible).toBe(false);
    expect(p.reason).toMatch(/no match/i);
  });

  it('skips when automation is switched off', () => {
    const p = reminderPlan({ ...base, enabled: false });
    expect(p.eligible).toBe(false);
    expect(p.reason).toMatch(/off/i);
  });

  it('still reports the correct pass when it is not eligible', () => {
    // The caller labels the skip reason with the pass, so it must be right
    // even when nothing is sent.
    expect(reminderPlan({ ...base, nowET: '2026-08-24', enabled: false }).pass).toBe('lastcall');
  });
});

describe('isDuplicate', () => {
  const now = '2026-08-21T14:00:00.000Z';

  it('is false when nothing was ever sent', () => {
    expect(isDuplicate(null, now)).toBe(false);
  });

  it('is true for a send an hour ago', () => {
    expect(isDuplicate('2026-08-21T13:00:00.000Z', now)).toBe(true);
  });

  it(`is false for a send older than ${DEDUPE_HOURS} hours`, () => {
    expect(isDuplicate('2026-08-20T01:00:00.000Z', now)).toBe(false);
  });

  it('is true exactly inside the boundary and false exactly outside', () => {
    const inside = new Date(Date.parse(now) - (DEDUPE_HOURS - 1) * 3600_000).toISOString();
    const outside = new Date(Date.parse(now) - (DEDUPE_HOURS + 1) * 3600_000).toISOString();
    expect(isDuplicate(inside, now)).toBe(true);
    expect(isDuplicate(outside, now)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/lib/admin/reminder-window.test.ts`

Expected: FAIL with a resolution error such as `Failed to load url ./reminder-window`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/admin/reminder-window.ts`:

```ts
/**
 * When a lineup reminder should go out, and which of the two passes it is.
 *
 * Pure on purpose: no database, no clock, no email. The route supplies the
 * dates and this decides, which is what makes the match-day case testable.
 *
 * The window is measured in ET CALENDAR DAYS, never in elapsed milliseconds.
 * The previous version subtracted timestamps, and because matchDate is stored
 * at midnight a 10am match-day run produced about -0.58, tripped a
 * `daysUntilMatch < 0` guard, and reported success while mailing nobody.
 * Whole-day arithmetic also means DST cannot shift the answer.
 */

export type ReminderPass = 'reminder' | 'lastcall';

/** How recently a send suppresses the next one for the same week and pass. */
export const DEDUPE_HOURS = 12;

/** Furthest ahead of the match a first ask will go out. */
const MAX_DAYS_AHEAD = 4;

export interface ReminderPlanInput {
  /** Today in America/New_York, 'YYYY-MM-DD'. */
  nowET: string;
  /** The week's match date, 'YYYY-MM-DD', or null when nothing is scheduled. */
  matchDate: string | null;
  /** The lineupAutomation flag. */
  enabled: boolean;
}

export interface ReminderPlanResult {
  eligible: boolean;
  pass: ReminderPass;
  /** Calendar days until the match, or null when there is no match date. */
  days: number | null;
  reason: string;
}

/** Whole calendar days from one 'YYYY-MM-DD' to another. */
export function daysUntil(nowET: string, matchDate: string): number {
  const from = Date.parse(`${nowET}T00:00:00Z`);
  const to = Date.parse(`${matchDate}T00:00:00Z`);
  return Math.round((to - from) / 86_400_000);
}

export function reminderPlan(input: ReminderPlanInput): ReminderPlanResult {
  const { nowET, matchDate, enabled } = input;

  if (!matchDate) {
    return { eligible: false, pass: 'reminder', days: null, reason: 'no match scheduled' };
  }

  const days = daysUntil(nowET, matchDate);
  // Derived from the date, not from which cron fired, so the copy always
  // matches real urgency even if a holiday shifts the night.
  const pass: ReminderPass = days === 0 ? 'lastcall' : 'reminder';

  if (!enabled) {
    return { eligible: false, pass, days, reason: 'automation is off' };
  }
  if (days < 0) {
    return { eligible: false, pass, days, reason: `match was ${-days} day(s) ago, in the past` };
  }
  if (days > MAX_DAYS_AHEAD) {
    return { eligible: false, pass, days, reason: `match is ${days} days away, too early` };
  }

  return { eligible: true, pass, days, reason: days === 0 ? 'match day' : `${days} day(s) out` };
}

/** True when a send for this same week and pass is recent enough to suppress another. */
export function isDuplicate(lastSentAt: string | null, nowISO: string): boolean {
  if (!lastSentAt) return false;
  const age = Date.parse(nowISO) - Date.parse(lastSentAt);
  if (Number.isNaN(age)) return false;
  return age < DEDUPE_HOURS * 3600_000;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- src/lib/admin/reminder-window.test.ts`

Expected: PASS, 15 tests (4 for `daysUntil`, 7 for `reminderPlan`, 4 for `isDuplicate`).

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin/reminder-window.ts src/lib/admin/reminder-window.test.ts
git commit -m "feat(admin): calendar-day reminder window, fixing the match-day skip"
```

---

### Task 2: The action log

**Files:**
- Create: `src/lib/admin/action-log.ts`

No unit test. Every function here is a thin database call with no branching worth
asserting; it is covered by the routes that use it.

- [ ] **Step 1: Write the module**

Create `src/lib/admin/action-log.ts`:

```ts
/**
 * Timestamps for actions that leave no other trace.
 *
 * Sending an email, pushing to LeaguePals and printing scoresheets do not write
 * to any table, so unlike scores or match results they cannot be read back out.
 * Recording them here is what lets the pre-night board derive its rows instead
 * of asking anyone to tick a box.
 *
 * Same MERGE the weekly recap email already uses (`evillair/email/route.ts`),
 * which records `emailSent-s{seasonID}-w{week}` for the post-night board.
 */

import sql from 'mssql';
import { getDb } from '@/lib/db';
import type { ReminderPass } from './reminder-window';

/** Flag controlling whether the cron sends at all. Value is 'on' or 'off'. */
export const AUTOMATION_KEY = 'lineupAutomation';

/**
 * Keys stay under leagueSettings.settingKey's varchar(50).
 * Longest is remindSent-s36-w4-reminder at 28 characters.
 */
export const actionKeys = {
  remind: (seasonID: number, week: number, pass: ReminderPass) =>
    `remindSent-s${seasonID}-w${week}-${pass}`,
  lpPush: (seasonID: number, week: number) => `lpPushed-s${seasonID}-w${week}`,
  scoresheets: (seasonID: number, week: number) => `scoresheets-s${seasonID}-w${week}`,
};

/** Stamp an action as done now. Never throws: recording must not fail the action. */
export async function recordAction(key: string): Promise<void> {
  try {
    const db = await getDb();
    await db
      .request()
      .input('key', sql.VarChar(50), key)
      .input('value', sql.VarChar(255), new Date().toISOString())
      .query(`
        MERGE leagueSettings AS target
        USING (SELECT @key AS settingKey) AS source
        ON target.settingKey = source.settingKey
        WHEN MATCHED THEN UPDATE SET settingValue = @value
        WHEN NOT MATCHED THEN INSERT (settingKey, settingValue) VALUES (@key, @value);
      `);
  } catch (err) {
    console.error(`[ACTION_LOG] action succeeded but recording "${key}" failed:`, err);
  }
}

/** Read several settings at once. Missing keys come back as null. */
export async function readSettings(keys: string[]): Promise<Record<string, string | null>> {
  const out: Record<string, string | null> = {};
  for (const k of keys) out[k] = null;
  if (keys.length === 0) return out;

  try {
    const db = await getDb();
    const req = db.request();
    const params = keys.map((k, i) => {
      req.input(`k${i}`, sql.VarChar(50), k);
      return `@k${i}`;
    });
    const res = await req.query<{ settingKey: string; settingValue: string }>(
      `SELECT settingKey, settingValue FROM leagueSettings
       WHERE settingKey IN (${params.join(', ')})`,
    );
    for (const row of res.recordset) out[row.settingKey] = row.settingValue ?? null;
  } catch (err) {
    console.error('[ACTION_LOG] reading settings failed:', err);
  }
  return out;
}

/** Whether the cron is allowed to send. Defaults to OFF when unset. */
export async function automationEnabled(): Promise<boolean> {
  const s = await readSettings([AUTOMATION_KEY]);
  return s[AUTOMATION_KEY] === 'on';
}

/** Turn the cron on or off without a deploy. */
export async function setAutomationEnabled(on: boolean): Promise<void> {
  const db = await getDb();
  await db
    .request()
    .input('key', sql.VarChar(50), AUTOMATION_KEY)
    .input('value', sql.VarChar(255), on ? 'on' : 'off')
    .query(`
      MERGE leagueSettings AS target
      USING (SELECT @key AS settingKey) AS source
      ON target.settingKey = source.settingKey
      WHEN MATCHED THEN UPDATE SET settingValue = @value
      WHEN NOT MATCHED THEN INSERT (settingKey, settingValue) VALUES (@key, @value);
    `);
}
```

Note `automationEnabled` defaults to **off** when the key is missing. That is the
off-by-default rollout: deploying this cannot itself start mailing captains.

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/admin/action-log.ts
git commit -m "feat(admin): record actions that leave no other trace"
```

---

### Task 3: Shared recipient query and email copy

**Files:**
- Create: `src/lib/admin/lineup-reminders.ts`

This is where the missing week filter gets fixed, once, for both callers.

- [ ] **Step 1: Write the module**

Create `src/lib/admin/lineup-reminders.ts`:

```ts
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
}

/** Mail each recipient, paced for Resend's 2 per second cap. */
export async function sendReminders(
  recipients: ReminderRecipient[],
  pass: ReminderPass,
  week: number,
): Promise<SendOutcome> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY not configured');

  const resend = new Resend(apiKey);
  const from = process.env.RECAP_FROM_ADDRESS || 'Splitzkrieg <noreply@splitzkrieg.com>';

  const outcome: SendOutcome = { sent: 0, skipped: 0, noEmail: [], errors: [] };

  for (const team of recipients) {
    if (!team.email) {
      outcome.noEmail.push(team.teamName);
      outcome.skipped++;
      continue;
    }

    // Resend free tier caps at 2 emails a second, so pace the loop.
    if (outcome.sent > 0) await new Promise((r) => setTimeout(r, 600));

    const { subject, html } = reminderEmail({
      pass,
      week,
      teamName: team.teamName,
      captainName: team.bowlerName || 'Captain',
    });

    try {
      await resend.emails.send({ from, to: team.email, subject, html });
      outcome.sent++;
    } catch (err) {
      outcome.errors.push(
        `${team.teamName}: ${err instanceof Error ? err.message : 'send failed'}`,
      );
    }
  }

  return outcome;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/admin/lineup-reminders.ts
git commit -m "feat(admin): shared lineup reminder module with the week filter fixed"
```

---

### Task 4: Rewrite the cron route

**Files:**
- Rewrite: `src/app/api/cron/lineup-reminder/route.ts`

- [ ] **Step 1: Replace the file entirely**

Replace the whole contents of `src/app/api/cron/lineup-reminder/route.ts` with:

```ts
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
import sql from 'mssql';
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
```

Note the `sql` import is no longer needed if nothing else uses it. If `npx tsc --noEmit`
or lint reports `sql` as unused, delete that import line.

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/cron/lineup-reminder/route.ts
git commit -m "fix(cron): send on match day, filter recipients by week"
```

---

### Task 5: Record the three manual actions

**Files:**
- Modify: `src/app/api/evillair/remind-captains/route.ts`
- Modify: `src/app/api/evillair/lineups/push/route.ts:25-27`
- Modify: `src/app/api/evillair/scoresheets/route.ts`

- [ ] **Step 1: Point the manual remind route at the shared module**

In `src/app/api/evillair/remind-captains/route.ts`, replace everything from the
`const db = await getDb();` line (line 37) through the end of the `for` loop (line 126)
with the following, keeping the surrounding `try`, the `teamIDFilter` block above it and
the `NextResponse.json` below it:

```ts
    const all = await findMissingLineups(seasonID, week);
    const teams = teamIDFilter ? all.filter((t) => teamIDFilter.has(t.teamID)) : all;

    if (teams.length === 0) {
      return NextResponse.json({ sent: 0, skipped: 0, message: 'All teams have submitted!' });
    }

    // Same pass the cron would choose right now, so a manual send suppresses
    // the scheduled one for this week through the shared record.
    const matchDate = await getUpcomingMatchDate(seasonID, week);
    const { pass } = reminderPlan({ nowET: todayET(), matchDate, enabled: true });

    const outcome = await sendReminders(teams, pass, week);
    if (outcome.sent > 0) await recordAction(actionKeys.remind(seasonID, week, pass));

    const { sent, skipped, noEmail, errors } = outcome;
```

Replace the file's imports with:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/auth';
import { getUpcomingMatchDate } from '@/lib/admin/scoresheets';
import { reminderPlan } from '@/lib/admin/reminder-window';
import { actionKeys, recordAction } from '@/lib/admin/action-log';
import { findMissingLineups, sendReminders } from '@/lib/admin/lineup-reminders';
```

Add this helper just below the imports, above `export async function POST`:

```ts
/** Today's date in league time, as 'YYYY-MM-DD'. */
function todayET(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}
```

`enabled: true` is deliberate. The off switch pauses the **cron**, not your own button.

- [ ] **Step 2: Record a successful LP push**

In `src/app/api/evillair/lineups/push/route.ts`, add to the imports:

```ts
import { actionKeys, recordAction } from '@/lib/admin/action-log';
```

Then replace line 25 through line 27:

```ts
    const result = await pushLineupsToLP(cookie, seasonID, week, teamID);

    return NextResponse.json(result);
```

with:

```ts
    const result = await pushLineupsToLP(cookie, seasonID, week, teamID);

    // Only a full-week push counts for the board. A single-team push is a
    // repair, not the step, so it must not mark the week as pushed.
    if (!teamID) await recordAction(actionKeys.lpPush(seasonID, week));

    return NextResponse.json(result);
```

- [ ] **Step 3: Record a generated scoresheet**

In `src/app/api/evillair/scoresheets/route.ts`, add to the imports:

```ts
import { actionKeys, recordAction } from '@/lib/admin/action-log';
```

Find the point where the PDF is about to be returned, the `return new NextResponse(...)`
carrying the `Content-Disposition` header near line 54, and insert immediately before it:

```ts
    await recordAction(actionKeys.scoresheets(seasonID, week));
```

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 5: Run the full suite**

Run: `npm test`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/evillair/remind-captains/route.ts src/app/api/evillair/lineups/push/route.ts src/app/api/evillair/scoresheets/route.ts
git commit -m "feat(admin): record reminder sends, LP pushes and scoresheet generation"
```

---

### Task 6: Derived pre-night status (pure)

**Files:**
- Create: `src/lib/admin/pre-night-status.ts`
- Test: `src/lib/admin/pre-night-status.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/admin/pre-night-status.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { derivePreNightStatus, type PreNightCounts } from './pre-night-status';

const counts = (over: Partial<PreNightCounts> = {}): PreNightCounts => ({
  lineupsIn: 12,
  teamsScheduled: 20,
  captainsWithoutEmail: 0,
  remindSentAt: null,
  lastCallSentAt: null,
  lpPushedAt: null,
  scoresheetsAt: null,
  matchDate: '2026-08-24',
  nowET: '2026-08-21',
  automationEnabled: true,
  ...over,
});

const row = (c: PreNightCounts, key: string) => {
  const found = derivePreNightStatus(c).find((s) => s.key === key);
  if (!found) throw new Error(`no row ${key}`);
  return found;
};

describe('lineups row', () => {
  it('is done when every scheduled team has submitted', () => {
    expect(row(counts({ lineupsIn: 20 }), 'lineups').state).toBe('done');
  });

  it('is pending when some are missing and the match is days away', () => {
    expect(row(counts(), 'lineups').state).toBe('pending');
  });

  it('escalates to attention on match day', () => {
    expect(row(counts({ nowET: '2026-08-24' }), 'lineups').state).toBe('attention');
  });

  it('reports the count', () => {
    expect(row(counts(), 'lineups').detail).toContain('12/20');
  });

  it('mentions captains with no email address', () => {
    expect(row(counts({ captainsWithoutEmail: 2 }), 'lineups').detail).toContain('2');
  });
});

describe('reminder row', () => {
  it('is done once a send is recorded', () => {
    expect(row(counts({ remindSentAt: '2026-08-21T14:00:00.000Z' }), 'reminder').state).toBe('done');
  });

  it('says so when automation is off rather than looking merely pending', () => {
    const r = row(counts({ automationEnabled: false }), 'reminder');
    expect(r.state).toBe('attention');
    expect(r.detail).toMatch(/off/i);
  });

  it('is optional once every lineup is in', () => {
    expect(row(counts({ lineupsIn: 20 }), 'reminder').state).toBe('optional');
  });
});

describe('last call row', () => {
  it('is pending before match day', () => {
    expect(row(counts(), 'lastcall').state).toBe('pending');
  });

  it('needs attention on match day with lineups still missing', () => {
    expect(row(counts({ nowET: '2026-08-24' }), 'lastcall').state).toBe('attention');
  });

  it('is done once recorded', () => {
    const c = counts({ nowET: '2026-08-24', lastCallSentAt: '2026-08-24T14:00:00.000Z' });
    expect(row(c, 'lastcall').state).toBe('done');
  });

  it('is optional when nothing is missing', () => {
    expect(row(counts({ nowET: '2026-08-24', lineupsIn: 20 }), 'lastcall').state).toBe('optional');
  });
});

describe('lp push and scoresheets rows', () => {
  it('are pending when not recorded and the match is days away', () => {
    expect(row(counts(), 'lppush').state).toBe('pending');
    expect(row(counts(), 'scoresheets').state).toBe('pending');
  });

  it('need attention on match day when still not recorded', () => {
    const c = counts({ nowET: '2026-08-24' });
    expect(row(c, 'lppush').state).toBe('attention');
    expect(row(c, 'scoresheets').state).toBe('attention');
  });

  it('are done once recorded', () => {
    const c = counts({ lpPushedAt: '2026-08-23T18:00:00.000Z', scoresheetsAt: '2026-08-24T19:00:00.000Z' });
    expect(row(c, 'lppush').state).toBe('done');
    expect(row(c, 'scoresheets').state).toBe('done');
  });
});

describe('no scheduled match', () => {
  it('reports every row as unknown rather than inventing urgency', () => {
    const rows = derivePreNightStatus(counts({ matchDate: null }));
    expect(rows.every((r) => r.state === 'unknown')).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/lib/admin/pre-night-status.test.ts`

Expected: FAIL with a resolution error such as `Failed to load url ./pre-night-status`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/admin/pre-night-status.ts`:

```ts
/**
 * Where the coming bowling night stands, derived rather than recorded.
 *
 * Companion to week-status.ts, which does the same for the night just played.
 * One row here reads real data (how many lineups are in); the rest read
 * timestamps written by the action that performed them. Nothing is a tick.
 */

import { daysUntil } from './reminder-window';
import type { StepState, WeekStatusStep } from './week-status';

export interface PreNightCounts {
  lineupsIn: number;
  teamsScheduled: number;
  captainsWithoutEmail: number;
  remindSentAt: string | null;
  lastCallSentAt: string | null;
  lpPushedAt: string | null;
  scoresheetsAt: string | null;
  /** Match date for the week, 'YYYY-MM-DD', or null when none is scheduled. */
  matchDate: string | null;
  /** Today in America/New_York, 'YYYY-MM-DD'. */
  nowET: string;
  automationEnabled: boolean;
}

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { timeZone: 'America/New_York' });

export function derivePreNightStatus(counts: PreNightCounts): WeekStatusStep[] {
  // With no match on the books there is nothing to be early or late for, so
  // every row is honestly unknown rather than falsely urgent.
  if (!counts.matchDate) {
    return [
      { key: 'lineups', label: 'Lineups in', state: 'unknown', detail: 'no match scheduled' },
      { key: 'reminder', label: 'Reminder', state: 'unknown', detail: 'no match scheduled' },
      { key: 'lastcall', label: 'Last call', state: 'unknown', detail: 'no match scheduled' },
      { key: 'lppush', label: 'LP push', state: 'unknown', detail: 'no match scheduled' },
      { key: 'scoresheets', label: 'Scoresheets', state: 'unknown', detail: 'no match scheduled' },
    ];
  }

  const days = daysUntil(counts.nowET, counts.matchDate);
  const isMatchDay = days === 0;
  const allIn = counts.teamsScheduled > 0 && counts.lineupsIn >= counts.teamsScheduled;

  const lineupsDetail =
    `${counts.lineupsIn}/${counts.teamsScheduled} in` +
    (counts.captainsWithoutEmail > 0
      ? `, ${counts.captainsWithoutEmail} captain(s) have no email on file`
      : '');

  let lineupsState: StepState = 'pending';
  if (allIn) lineupsState = 'done';
  else if (isMatchDay) lineupsState = 'attention';

  // Off is a deliberate state worth surfacing loudly: the whole point of the
  // board is that a silent non-send never looks like success again.
  let reminderState: StepState;
  let reminderDetail: string;
  if (counts.remindSentAt) {
    reminderState = 'done';
    reminderDetail = `sent ${when(counts.remindSentAt)}`;
  } else if (allIn) {
    // Checked before the automation flag on purpose: once every lineup is in,
    // the cron being off is not a problem worth flagging.
    reminderState = 'optional';
    reminderDetail = 'not needed, all lineups in';
  } else if (!counts.automationEnabled) {
    reminderState = 'attention';
    reminderDetail = 'automation is off, nothing will send';
  } else {
    reminderState = 'pending';
    reminderDetail = days > 0 ? `scheduled, ${days} day(s) out` : 'not sent';
  }

  let lastCallState: StepState;
  let lastCallDetail: string;
  if (counts.lastCallSentAt) {
    lastCallState = 'done';
    lastCallDetail = `sent ${when(counts.lastCallSentAt)}`;
  } else if (allIn) {
    lastCallState = 'optional';
    lastCallDetail = 'not needed, all lineups in';
  } else if (isMatchDay) {
    lastCallState = 'attention';
    lastCallDetail = 'match day and lineups are still missing';
  } else {
    lastCallState = 'pending';
    lastCallDetail = 'not yet needed';
  }

  const actionRow = (
    key: string,
    label: string,
    at: string | null,
    missingDetail: string,
  ): WeekStatusStep => ({
    key,
    label,
    state: at ? 'done' : isMatchDay ? 'attention' : 'pending',
    detail: at ? when(at) : missingDetail,
  });

  return [
    { key: 'lineups', label: 'Lineups in', state: lineupsState, detail: lineupsDetail },
    { key: 'reminder', label: 'Reminder', state: reminderState, detail: reminderDetail },
    { key: 'lastcall', label: 'Last call', state: lastCallState, detail: lastCallDetail },
    actionRow('lppush', 'LP push', counts.lpPushedAt, 'not recorded'),
    actionRow('scoresheets', 'Scoresheets', counts.scoresheetsAt, 'not recorded'),
  ];
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- src/lib/admin/pre-night-status.test.ts`

Expected: PASS, 16 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin/pre-night-status.ts src/lib/admin/pre-night-status.test.ts
git commit -m "feat(admin): derived pre-night status"
```

---

### Task 7: The pre-night status API

**Files:**
- Create: `src/app/api/evillair/pre-night-status/route.ts`

- [ ] **Step 1: Write the route**

Create `src/app/api/evillair/pre-night-status/route.ts`:

```ts
/**
 * GET  /api/evillair/pre-night-status?seasonID=&week=  board rows for the coming night
 * PATCH same path, body { enabled: boolean }            the cron off switch
 */

import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import { requireAdminOrWriter } from '@/lib/admin/auth';
import { getDb } from '@/lib/db';
import { getUpcomingMatchDate } from '@/lib/admin/scoresheets';
import {
  AUTOMATION_KEY,
  actionKeys,
  readSettings,
  setAutomationEnabled,
} from '@/lib/admin/action-log';
import { countScheduledTeams, findMissingLineups } from '@/lib/admin/lineup-reminders';
import { derivePreNightStatus } from '@/lib/admin/pre-night-status';

export const dynamic = 'force-dynamic';

function todayET(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export async function GET(request: NextRequest) {
  try {
    await requireAdminOrWriter(request);
  } catch {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  const seasonID = Number(request.nextUrl.searchParams.get('seasonID'));
  const week = Number(request.nextUrl.searchParams.get('week'));
  if (!seasonID || !week) {
    return NextResponse.json({ error: 'seasonID and week are required' }, { status: 400 });
  }

  try {
    const db = await getDb();
    const submitted = await db
      .request()
      .input('seasonID', sql.Int, seasonID)
      .input('week', sql.Int, week)
      .query<{ n: number }>(
        `SELECT COUNT(DISTINCT teamID) AS n FROM lineupSubmissions
         WHERE seasonID = @seasonID AND week = @week`,
      );

    const missing = await findMissingLineups(seasonID, week);
    const keys = {
      reminder: actionKeys.remind(seasonID, week, 'reminder'),
      lastcall: actionKeys.remind(seasonID, week, 'lastcall'),
      lp: actionKeys.lpPush(seasonID, week),
      sheets: actionKeys.scoresheets(seasonID, week),
    };
    const settings = await readSettings([...Object.values(keys), AUTOMATION_KEY]);

    const steps = derivePreNightStatus({
      lineupsIn: submitted.recordset[0]?.n ?? 0,
      teamsScheduled: await countScheduledTeams(seasonID, week),
      captainsWithoutEmail: missing.filter((t) => !t.email).length,
      remindSentAt: settings[keys.reminder],
      lastCallSentAt: settings[keys.lastcall],
      lpPushedAt: settings[keys.lp],
      scoresheetsAt: settings[keys.sheets],
      matchDate: await getUpcomingMatchDate(seasonID, week),
      nowET: todayET(),
      automationEnabled: settings[AUTOMATION_KEY] === 'on',
    });

    return NextResponse.json({ steps, automationEnabled: settings[AUTOMATION_KEY] === 'on' });
  } catch (err) {
    console.error('Pre-night status error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load pre-night status' },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireAdminOrWriter(request);
  } catch {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  try {
    const { enabled } = await request.json();
    if (typeof enabled !== 'boolean') {
      return NextResponse.json({ error: 'enabled must be a boolean' }, { status: 400 });
    }
    await setAutomationEnabled(enabled);
    return NextResponse.json({ automationEnabled: enabled });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update' },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/evillair/pre-night-status/route.ts
git commit -m "feat(admin): pre-night status endpoint with automation toggle"
```

---

### Task 8: The board component and removing the ticks

**Files:**
- Create: `src/components/admin/PreNightStatusBoard.tsx`
- Modify: `src/app/evillair/(dashboard)/page.tsx`
- Modify: `src/app/api/evillair/dashboard/route.ts`

- [ ] **Step 1: Write the component**

Create `src/components/admin/PreNightStatusBoard.tsx`:

```tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import type { StepState, WeekStatusStep } from '@/lib/admin/week-status';

interface Props {
  seasonID: number;
  week: number;
}

/** Same legend as WeekStatusBoard so the two boards cannot drift apart. */
const STATE_STYLE: Record<StepState, { mark: string; className: string }> = {
  done: { mark: 'DONE', className: 'text-green-700 bg-green-50 border-green-200' },
  pending: { mark: 'WAITING', className: 'text-navy/70 bg-navy/[0.03] border-navy/15' },
  attention: { mark: 'ACTION', className: 'text-red-700 bg-red-50 border-red-300' },
  optional: { mark: 'OPTIONAL', className: 'text-navy/70 bg-navy/[0.03] border-navy/15' },
  unknown: { mark: 'UNKNOWN', className: 'text-navy/70 bg-navy/[0.03] border-navy/15' },
};

/**
 * Where the coming bowling night stands.
 *
 * Every row is read back out of the database, either as real lineup counts or
 * as a timestamp the acting route recorded. There is nothing to tick, which is
 * the point: the checklist this replaced went stale the moment a step was done
 * out of order.
 */
export function PreNightStatusBoard({ seasonID, week }: Props) {
  const [steps, setSteps] = useState<WeekStatusStep[] | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/evillair/pre-night-status?seasonID=${seasonID}&week=${week}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to load pre-night status');
      setSteps(data.steps);
      setEnabled(data.automationEnabled);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [seasonID, week]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleAutomation() {
    const next = !enabled;
    setEnabled(next);
    try {
      await fetch('/api/evillair/pre-night-status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: next }),
      });
      await load();
    } catch {
      setEnabled(!next);
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-navy/10 overflow-hidden">
      <div className="px-5 py-4 border-b border-navy/10 flex items-center justify-between">
        <div>
          <h2 className="font-heading text-sm text-navy">Pre-Bowling Night</h2>
          <p className="font-body text-xs text-navy/40 mt-0.5">Week {week} prep</p>
        </div>
        <button
          onClick={toggleAutomation}
          className="font-body text-xs text-navy/60 hover:text-navy underline underline-offset-2"
        >
          Reminder emails: {enabled ? 'on' : 'off'}
        </button>
      </div>

      <div className="p-5 space-y-2">
        {loading && !steps && <p className="font-body text-xs text-navy/50">Loading...</p>}
        {error && <p className="font-body text-xs text-red-700">{error}</p>}
        {steps?.map((s) => {
          const style = STATE_STYLE[s.state];
          return (
            <div
              key={s.key}
              className={`flex items-baseline justify-between gap-3 border rounded px-3 py-2 ${style.className}`}
            >
              <span className="font-heading text-sm">{s.label}</span>
              <span className="font-body text-xs text-right">
                {s.detail}
                <span className="ml-3 font-heading">{style.mark}</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Swap the board in and delete the ticks**

In `src/app/evillair/(dashboard)/page.tsx`:

1. Add to the imports:

```tsx
import { PreNightStatusBoard } from '@/components/admin/PreNightStatusBoard';
```

2. Delete the `PRE_NIGHT_STEPS` constant at lines 20 to 24.
3. Delete the entire `Pipeline` function beginning at line 28. It has exactly one
   consumer, at line 319, which is removed below. The other `Pipeline` matches in the
   codebase are an unrelated local variable in the scores page and prose on the specs
   page; leave those alone.
4. Delete the `toggleStep` callback beginning at line 117.
5. Delete `preNightDone: string[];` from the data interface at line 16, and the
   `const preNightDone = new Set(data?.preNightDone ?? []);` line at line 283.
6. Replace the whole `{/* Pre-Bowling Night */}` block, from its opening
   `<div className="bg-white rounded-lg ...">` through the `<Pipeline ... />` element and
   its closing tags, with:

```tsx
      {/* Pre-Bowling Night. Derived, never recorded. */}
      {data?.season && (
        <div className="mb-6">
          <PreNightStatusBoard seasonID={data.season.seasonID} week={nextWeek} />
        </div>
      )}
```

Keep the lineup team grid and its Select all / Clear all buttons that follow; they are
the manual remind controls and are still wanted.

- [ ] **Step 3: Delete the tick storage**

In `src/app/api/evillair/dashboard/route.ts`:

1. Delete the block that loads `preNightDone` and `postNightDone` (the
   `let preNightDone: string[] = [];` declaration through the closing brace of its `try`).
2. Remove `preNightDone` and `postNightDone` from the `NextResponse.json({ ... })` object.
3. Delete the entire `POST` handler, which exists only to toggle those keys.

`postNightDone` goes too. Its UI was already deleted in `812995f` and nothing reads it.

- [ ] **Step 4: Verify it compiles and lints**

Run: `npx tsc --noEmit`

Expected: no errors.

Run: `npm run lint`

Expected: no NEW errors. The repo has a pre-existing baseline of roughly 295 problems,
almost all in test files. Check specifically that neither
`src/app/evillair/(dashboard)/page.tsx` nor `src/app/api/evillair/dashboard/route.ts`
appears in the output. If either does, it is an unused import left behind by the
deletions.

- [ ] **Step 5: Run the full suite**

Run: `npm test`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/PreNightStatusBoard.tsx "src/app/evillair/(dashboard)/page.tsx" src/app/api/evillair/dashboard/route.ts
git commit -m "feat(admin): derived pre-night board, delete the last manual checklist"
```

---

### Task 9: Schedules, changelog and final checks

**Files:**
- Modify: `vercel.json`
- Modify: `content/updates.ts`

- [ ] **Step 1: Add the cron schedules**

Replace the contents of `vercel.json` with:

```json
{
  "regions": ["cle1"],
  "crons": [
    { "path": "/api/cron/lineup-reminder", "schedule": "0 14 * * 5" },
    { "path": "/api/cron/lineup-reminder", "schedule": "0 14 * * 1" }
  ]
}
```

Vercel crons are UTC only. `14:00 UTC` is 10am EDT, correct for weeks 4 through 8. DST
ends 2026-11-01 and week 9 falls on Monday 2026-11-02, so that one send lands at 9am ET.
This is known and accepted; do not add a third schedule for it.

- [ ] **Step 2: Add the changelog entries**

In `content/updates.ts`, insert as the first two entries of the `updates` array,
immediately after `const updates: Update[] = [`:

```ts
  { date: '2026-08-20', text: 'Lineup reminders now go out automatically on Friday, with a last call on bowling day', tag: 'feat' },
  { date: '2026-08-20', text: 'Admin dashboard shows derived pre-night status instead of a manual checklist', tag: 'feat' },
```

Do not use em dashes. `scripts/pre-push-check.mjs:54-61` fails the push on either the
U+2014 character or the `&mdash;` entity anywhere in `src/` or `content/`.

- [ ] **Step 3: Run the pre-push check**

Run: `node scripts/pre-push-check.mjs`

Expected: PASS on all four checks.

- [ ] **Step 4: Run the cache invariant check**

Run: `node scripts/check-cache-invariants.mjs`

Expected: PASS. Nothing in `src/lib/queries/` was touched, so no `cachedQuery` hash moves
and no channel busts. If this reports busts above zero, something was edited by mistake.

- [ ] **Step 5: Run the full suite**

Run: `npm test`

Expected: PASS, including the 15 reminder-window tests and 16 pre-night-status tests.

- [ ] **Step 6: Commit**

```bash
git add vercel.json content/updates.ts
git commit -m "feat(cron): schedule the Friday and match-day lineup reminders"
```

- [ ] **Step 7: Report, do not push**

Report what landed and hand over to the rollout below. Russ chooses the deploy window.

---

## Rollout, for Russ

The automation flag defaults to **off** when the key is missing, so deploying this cannot
start mailing captains on its own.

1. Deploy.
2. Dry run the endpoint by hand. It should report a skip with reason `automation is off`,
   which proves auth, the season lookup and the date maths all work without sending:

```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" \
  https://splitzkrieg.com/api/cron/lineup-reminder | jq
```

3. Open `/evillair`, check the pre-night board names the right week and a sane
   lineups-in count, then click `Reminder emails: off` to switch it on.
4. Re-run the curl. It should now report the real recipient count. If it is a Friday or a
   bowling Monday within the window, **this sends real email**, so run it deliberately.

To pause a week, click the toggle back to off. No deploy needed.

## Notes carried from the spec

- **No cache impact.** No SQL in `src/lib/queries/` changes, so no `cachedQuery` hashes
  move and no channels bust.
- **Publish-week discipline.** Do not land this during a publish window.
- **Playoffs need no special case.** After week 9, `publishedWeek + 1` finds no schedule
  row, `getUpcomingMatchDate` returns null, and `reminderPlan` skips with
  `no match scheduled`.
