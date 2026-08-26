#!/usr/bin/env node
/**
 * Advance the league's "latest completed week" pointer by hand.
 *
 * The admin confirm pipeline normally does this as its LAST step
 * (`recordWeekCompleted` in src/lib/admin/scores.ts). When a week is imported
 * with scripts instead (e.g. S36 week 4, imported from paper scoresheets after
 * the lanes failed), that step never runs and the pointer silently stays behind.
 *
 * That matters: `/api/cron/lineup-reminder` sends to `publishedWeek + 1`, so a
 * stale pointer re-sends the week that was already bowled instead of the next one.
 *
 * Mirrors nextWeekPointer(): within a season the pointer only moves FORWARD,
 * across a season boundary it takes the new week outright.
 *
 * Usage:
 *   node scripts/advance-week-pointer.mjs --season=36 --week=4            # DRY RUN
 *   node scripts/advance-week-pointer.mjs --season=36 --week=4 --commit
 */
import sql from 'mssql';
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const COMMIT = process.argv.includes('--commit');
const arg = (k, d) => { const h = process.argv.find(a => a.startsWith(`--${k}=`)); return h ? h.split('=')[1] : d; };
const SEASON = parseInt(arg('season'), 10);
const WEEK = parseInt(arg('week'), 10);
if (!SEASON || !WEEK) { console.error('need --season=N --week=N'); process.exit(1); }

const env = readFileSync(resolve(ROOT, '.env.local'), 'utf8');
for (const l of env.split('\n')) { const m = l.match(/^([^#=]+)=(.*)$/); if (m) process.env[m[1].trim()] = m[2].trim(); }
const pool = await sql.connect({
  server: process.env.AZURE_SQL_SERVER, database: process.env.AZURE_SQL_DATABASE,
  user: process.env.AZURE_SQL_USER, password: process.env.AZURE_SQL_PASSWORD,
  options: { encrypt: true, trustServerCertificate: false, connectTimeout: 120000, requestTimeout: 60000 },
});

const rows = (await pool.request().query(
  `SELECT settingKey, settingValue FROM leagueSettings
   WHERE settingKey IN ('publishedWeek','publishedSeasonID')`)).recordset;
const s = Object.fromEntries(rows.map(r => [r.settingKey, r.settingValue]));
const curWeek = s.publishedWeek != null ? parseInt(s.publishedWeek, 10) : NaN;
const curSeason = s.publishedSeasonID != null ? parseInt(s.publishedSeasonID, 10) : NaN;

const next = (Number.isNaN(curWeek) || curSeason !== SEASON)
  ? { seasonID: SEASON, week: WEEK }
  : { seasonID: SEASON, week: Math.max(curWeek, WEEK) };

console.log(COMMIT ? '=== COMMIT ===' : '=== DRY RUN (pass --commit to write) ===');
console.log(`  pointer  S${curSeason} wk${curWeek}  ->  S${next.seasonID} wk${next.week}`);

const tagPath = resolve(ROOT, '.published-week');
const curTag = readFileSync(tagPath, 'utf8').trim();
const nextTag = `s${next.seasonID}-w${next.week}`;
console.log(`  .published-week  "${curTag}"  ->  "${nextTag}"`);

if (COMMIT) {
  await pool.request().input('v', sql.VarChar(255), String(next.week))
    .query(`UPDATE leagueSettings SET settingValue=@v WHERE settingKey='publishedWeek'`);
  await pool.request().input('v', sql.VarChar(255), String(next.seasonID))
    .query(`UPDATE leagueSettings SET settingValue=@v WHERE settingKey='publishedSeasonID'`);
  if (curTag !== nextTag) writeFileSync(tagPath, nextTag + '\n');
  console.log('  written');
}
await pool.close();
