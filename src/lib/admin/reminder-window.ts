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

  // Belt and braces: todayET() is hardened against this (see clock.ts), but an
  // unreadable date must never fall through to eligible. NaN < 0 and
  // NaN > MAX_DAYS_AHEAD are both false, so without this guard a broken date
  // string would sail past every bound check below and mail everyone.
  if (!Number.isFinite(days)) {
    return { eligible: false, pass: 'reminder', days: null, reason: 'unreadable match date' };
  }

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
