#!/usr/bin/env node
/**
 * Bump the per-bowler cache version for everyone who bowled a given week.
 *
 * `getBowlerPageView` is cached per bowler: no `dependsOn`, and because it
 * passes `bowlerID` the published-week tag is deliberately excluded too
 * (`src/lib/db.ts`). Its key is therefore `bv<DATA_VERSIONS.bowlers[bowlerID]>`
 * and NOTHING else about a weekly import can move it.
 *
 * db.ts says "Import scripts bump DATA_VERSIONS.bowlers[bowlerID] for each
 * bowler who bowled". That was not true of any current path: neither
 * `bumpCacheAndPublish` nor `populate-match-results.mjs` touches
 * `versions.bowlers`, they bump only `scores[seasonID]` and
 * `schedule[seasonID]`. So a bowler's page could keep serving pre-week data
 * until something else evicted the entry, which is why the staleness looked
 * intermittent rather than permanent: bowler pages render on demand, so a cold
 * cache re-queries and looks fine, and a warm stale one does not.
 *
 * Caught on S36 week 4: Denis Webb's page had his 225 (bowled exactly once
 * ever, that week) sitting at count 0 in the score map.
 *
 * Safe to run for a whole week: bowler pages are NOT prebuilt
 * (generateStaticParams returns [] without BUILD_ALL), so the invalidated
 * pages re-query lazily as visitors arrive rather than all at once at build
 * time. This is the ~80-page bust a normal publish week already implies.
 *
 * Usage:
 *   node scripts/bump-bowler-cache.mjs --season=36 --week=4            # DRY RUN
 *   node scripts/bump-bowler-cache.mjs --season=36 --week=4 --commit
 */
import sql from 'mssql';
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const COMMIT = process.argv.includes('--commit');
const arg = (k) => { const h = process.argv.find(a => a.startsWith(`--${k}=`)); return h ? h.split('=')[1] : null; };
const SEASON = parseInt(arg('season'), 10);
const WEEK = parseInt(arg('week'), 10);
// --ids= is for bowlers whose PAGE changed without their scores changing, e.g. a
// backfilled patch. Same cache problem, different trigger.
const IDS = (arg('ids') ?? '').split(',').map(x => parseInt(x, 10)).filter(Number.isFinite);
if (!IDS.length && (!SEASON || !WEEK)) {
  console.error('need --season=N --week=N, or --ids=1,2,3');
  process.exit(1);
}

const env = readFileSync(resolve(ROOT, '.env.local'), 'utf8');
for (const l of env.split('\n')) { const m = l.match(/^([^#=]+)=(.*)$/); if (m) process.env[m[1].trim()] = m[2].trim(); }
const pool = await sql.connect({
  server: process.env.AZURE_SQL_SERVER, database: process.env.AZURE_SQL_DATABASE,
  user: process.env.AZURE_SQL_USER, password: process.env.AZURE_SQL_PASSWORD,
  options: { encrypt: true, trustServerCertificate: false, connectTimeout: 120000, requestTimeout: 60000 },
});

const rows = IDS.length
  ? (await pool.request().query(
      `SELECT bowlerID, bowlerName FROM bowlers WHERE bowlerID IN (${IDS.join(',')}) ORDER BY bowlerName`)).recordset
  : (await pool.request()
      .input('s', sql.Int, SEASON).input('w', sql.Int, WEEK)
      .query(`SELECT DISTINCT s.bowlerID, b.bowlerName FROM scores s
              JOIN bowlers b ON b.bowlerID = s.bowlerID
              WHERE s.seasonID = @s AND s.week = @w
              ORDER BY b.bowlerName`)).recordset;
await pool.close();

const versionsPath = resolve(ROOT, '.data-versions.json');
const versions = JSON.parse(readFileSync(versionsPath, 'utf8'));
if (!versions.bowlers) versions.bowlers = {};

console.log(COMMIT ? '=== COMMIT ===' : '=== DRY RUN (pass --commit to write) ===');
console.log(IDS.length
  ? `${rows.length} bowler(s) by explicit id\n`
  : `${rows.length} bowler(s) with scores in S${SEASON} week ${WEEK}\n`);
for (const r of rows) {
  const k = String(r.bowlerID);
  const before = versions.bowlers[k] ?? 1;
  versions.bowlers[k] = before + 1;
  console.log(`  ${r.bowlerName.padEnd(22)} bowlerID ${String(r.bowlerID).padStart(4)}  bv${before} -> bv${before + 1}`);
}
if (COMMIT) {
  writeFileSync(versionsPath, JSON.stringify(versions, null, 2) + '\n');
  console.log(`\nwrote ${versionsPath}`);
} else {
  console.log('\n(nothing written)');
}
