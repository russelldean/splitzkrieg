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
 * Longest is remindSent-s36-w4-reminder at 26 characters.
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
