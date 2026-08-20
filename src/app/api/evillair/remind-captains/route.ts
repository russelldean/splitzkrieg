/**
 * POST /api/evillair/remind-captains
 *
 * Manual counterpart to the cron at /api/cron/lineup-reminder: sends to
 * captains who have not yet submitted a lineup, picking the same pass
 * (reminder or last call) the cron would pick right now from the match date.
 * Deliberately ignores the automation off switch: a human pressing this
 * button means send regardless of whether the scheduled runs are paused.
 * Records the send under the shared action-log key, so a manual send stands
 * down the scheduled one for this week and pass.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/auth';
import { todayET } from '@/lib/admin/clock';
import { getUpcomingMatchDate } from '@/lib/admin/scoresheets';
import { reminderPlan } from '@/lib/admin/reminder-window';
import { actionKeys, recordAction } from '@/lib/admin/action-log';
import { findMissingLineups, sendReminders } from '@/lib/admin/lineup-reminders';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);
  } catch {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  try {
    const { seasonID, week, teamIDs } = await request.json();
    if (!seasonID || !week) {
      return NextResponse.json(
        { error: 'seasonID and week are required' },
        { status: 400 },
      );
    }

    // Optional filter: only remind specific teams
    const teamIDFilter: Set<number> | null =
      Array.isArray(teamIDs) && teamIDs.length > 0
        ? new Set(teamIDs as number[])
        : null;

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
