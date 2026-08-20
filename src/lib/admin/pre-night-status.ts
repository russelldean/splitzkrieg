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
