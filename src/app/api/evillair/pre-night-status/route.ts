/**
 * GET  /api/evillair/pre-night-status?seasonID=&week=  board rows for the coming night
 * PATCH same path, body { enabled: boolean }            the cron off switch
 */

import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import { requireAdminOrWriter } from '@/lib/admin/auth';
import { getDb } from '@/lib/db';
import { todayET } from '@/lib/admin/clock';
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
