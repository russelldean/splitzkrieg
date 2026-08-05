#!/usr/bin/env node
/**
 * Post-cascade gate. Run this after importing a week and running
 * match-results -> patches -> milestones -> facts, BEFORE publishing.
 *
 * Every check here exists because something silently went wrong on 2026-08-04:
 *   - a substitution was filed under the rostered bowler, inheriting their handicap,
 *     which flipped a match and changed Bowler of the Week  -> checks 1, 6
 *   - matchResults were computed from those wrong scores                -> check 3
 *   - S36 wk1 shipped with no Weekly High Game / High Series            -> check 4
 *   - S35 shipped with ZERO scratch-playoff patches                     -> check 4
 *   - populate-facts.mjs threw and left the week half-populated         -> check 5
 *
 * Exits non-zero if anything fails, so it can gate a publish.
 *
 * Usage: node scripts/verify-week.mjs --season=36 --week=2 [--staging=docs/pending]
 */
import sql from 'mssql';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const arg = (k, d) => { const h = process.argv.find(a => a.startsWith(`--${k}=`)); return h ? h.split('=')[1] : d; };
const SEASON = parseInt(arg('season', '36'), 10);
const WEEK = parseInt(arg('week'), 10);
const STAGING = resolve(ROOT, arg('staging', 'docs/pending'));
if (!WEEK) { console.error('need --week=N'); process.exit(1); }

const env = readFileSync(resolve(ROOT, '.env.local'), 'utf8');
for (const l of env.split('\n')) { const m = l.match(/^([^#=]+)=(.*)$/); if (m) process.env[m[1].trim()] = m[2].trim(); }
const pool = await sql.connect({
  server: process.env.AZURE_SQL_SERVER, database: process.env.AZURE_SQL_DATABASE,
  user: process.env.AZURE_SQL_USER, password: process.env.AZURE_SQL_PASSWORD,
  options: { encrypt: true, trustServerCertificate: false, connectTimeout: 180000, requestTimeout: 180000 },
});
const q = async (s) => (await pool.request().query(s)).recordset;

let fails = 0, warns = 0;
const ok = (m) => console.log(`  ok    ${m}`);
const bad = (m) => { fails++; console.log(`  FAIL  ${m}`); };
const warn = (m) => { warns++; console.log(`  warn  ${m}`); };

console.log(`\nVERIFY S${SEASON} week ${WEEK}\n`);

// ── 1. staging files vs DB ───────────────────────────────────────────────────
console.log('1. staging vs database');
const files = existsSync(STAGING)
  ? readdirSync(STAGING).filter(f => f.startsWith(`s${SEASON}-week-${WEEK}`) && f.endsWith('.json'))
  : [];
if (!files.length) warn(`no staging file for week ${WEEK} — cannot cross-check the import`);
else {
  const staged = [];
  for (const f of files) {
    const s = JSON.parse(readFileSync(join(STAGING, f), 'utf8'));
    for (const m of s.matches) for (const b of m.bowlers) staged.push(b);
  }
  const db = await q(`SELECT bowlerID, teamID, game1, game2, game3, turkeys, incomingAvg
                      FROM scores WHERE seasonID=${SEASON} AND week=${WEEK}`);
  const k = (r) => `${r.bowlerID}|${r.teamID}`;
  const dbMap = new Map(db.map(r => [k(r), r]));
  let diff = 0;
  for (const st of staged) {
    const d = dbMap.get(k(st));
    if (!d) { diff++; bad(`in staging but not DB: bowlerID ${st.bowlerID} team ${st.teamID}`); continue; }
    if (d.game1 !== st.game1 || d.game2 !== st.game2 || d.game3 !== st.game3) { diff++; bad(`games differ for bowlerID ${st.bowlerID}`); }
    if ((d.turkeys || 0) !== (st.turkeys || 0)) { diff++; bad(`turkeys differ for bowlerID ${st.bowlerID}`); }
  }
  if (staged.length !== db.length) bad(`staged ${staged.length} rows, DB has ${db.length}`);
  else if (!diff) ok(`${db.length} rows match staging (${files.length} night file(s))`);
}

// ── 2. shape ────────────────────────────────────────────────────────────────
console.log('\n2. week shape');
const dup = await q(`SELECT bowlerID FROM scores WHERE seasonID=${SEASON} AND week=${WEEK} GROUP BY bowlerID HAVING COUNT(*)>1`);
dup.length ? bad(`${dup.length} bowler(s) appear twice`) : ok('no bowler appears twice');
const teams = await q(`SELECT teamID, COUNT(*) n FROM scores WHERE seasonID=${SEASON} AND week=${WEEK} GROUP BY teamID`);
const wrong = teams.filter(t => t.n !== 4);
wrong.length ? bad(`${wrong.length} team(s) without exactly 4 bowlers`) : ok(`${teams.length} teams, 4 bowlers each`);
const sched = await q(`SELECT team1ID a, team2ID b FROM schedule WHERE seasonID=${SEASON} AND week=${WEEK}`);
const schedSet = new Set(sched.flatMap(r => [r.a, r.b]));
const stray = teams.map(t => t.teamID).filter(t => !schedSet.has(t));
stray.length ? bad(`scores for unscheduled team(s): ${stray.join(', ')}`) : ok('every scoring team is on the schedule');

// ── 3. handicap + match totals ──────────────────────────────────────────────
console.log('\n3. handicap and match totals');
const hc = await q(`SELECT bowlerID, incomingAvg, incomingHcp, game1, hcpGame1
                    FROM scores WHERE seasonID=${SEASON} AND week=${WEEK} AND isPenalty=0`);
let hbad = 0, noavg = 0;
for (const r of hc) {
  if (r.incomingAvg == null) { noavg++; if (r.hcpGame1 !== 219) { hbad++; bad(`bowlerID ${r.bowlerID} no-average but hcpGame1=${r.hcpGame1}, expected flat 219`); } continue; }
  const exp = Math.floor((225 - Math.max(70, Math.floor(r.incomingAvg))) * 0.95);
  if (Number(r.incomingHcp) !== exp || r.hcpGame1 !== r.game1 + exp) { hbad++; bad(`bowlerID ${r.bowlerID} handicap ${r.incomingHcp}, expected ${exp}`); }
}
if (!hbad) ok(`${hc.length - noavg} handicaps match the formula; ${noavg} no-average bowler(s) at flat 219`);
const mr = await q(`
  SELECT s.matchNumber, mr.team1Series a, mr.team2Series b,
    (SELECT SUM(handSeries) FROM scores WHERE seasonID=${SEASON} AND week=${WEEK} AND teamID=s.team1ID) sa,
    (SELECT SUM(handSeries) FROM scores WHERE seasonID=${SEASON} AND week=${WEEK} AND teamID=s.team2ID) sb
  FROM matchResults mr JOIN schedule s ON s.scheduleID=mr.scheduleID
  WHERE s.seasonID=${SEASON} AND s.week=${WEEK}`);
mr.length !== sched.length
  ? bad(`${mr.length} matchResults for ${sched.length} scheduled matches`)
  : ok(`${mr.length} matchResults, one per scheduled match`);
const mismatch = mr.filter(r => r.a !== r.sa || r.b !== r.sb);
mismatch.length
  ? mismatch.forEach(r => bad(`M${r.matchNumber} series ${r.a}/${r.b} != bowler sums ${r.sa}/${r.sb}`))
  : ok('every match series equals the sum of its bowlers');

// ── 4. patches, CURRENT SEASON ──────────────────────────────────────────────
// Season scope, not week scope: scratchPlayoff / hcpPlayoff rank the whole season's
// averages, so every new week can change who sits in the top 8. Week-scoping this is
// how S35 finished a season with zero scratch-playoff patches and nobody noticed.
// Past seasons are NOT re-audited here — they only change if we deliberately change
// them, and then you run `audit-patches.mjs` (all seasons) on purpose.
console.log(`\n4. patch coverage (season ${SEASON})`);
try {
  execSync(`node scripts/audit-patches.mjs --season=${SEASON} --quiet`, { cwd: ROOT, stdio: 'pipe' });
  ok(`all season ${SEASON} patches up to date`);
} catch (e) {
  const out = (e.stdout?.toString() || '').split('\n').filter(l => l.includes('<<<') || l.includes('MISSING,'));
  bad('patch audit found discrepancies:');
  out.forEach(l => console.log(`        ${l.trim()}`));
  console.log('        run: node scripts/audit-patches.mjs   (--fix to insert)');
}

// ── 5. derived tables populated ─────────────────────────────────────────────
console.log('\n5. derived tables');
for (const [t, label] of [['bowlerPatches', 'patches'], ['facts', 'facts']]) {
  const n = (await q(`SELECT COUNT(*) n FROM ${t} WHERE seasonID=${SEASON} AND week=${WEEK}`))[0].n;
  n === 0 ? bad(`${label}: 0 rows for this week — did the cascade step run?`) : ok(`${label}: ${n} rows`);
}
const ms = (await q(`SELECT COUNT(*) n FROM bowlerMilestones WHERE seasonID=${SEASON} AND week=${WEEK}`))[0].n;
ok(`milestones: ${ms} rows (zero is legitimate)`);
const dupF = await q(`SELECT factTypeID, bowlerID FROM facts WHERE seasonID=${SEASON} AND week=${WEEK}
                      GROUP BY factTypeID, bowlerID HAVING COUNT(*)>1`);
dupF.length ? bad(`${dupF.length} duplicated fact row(s) — a re-run without clearing?`) : ok('no duplicate facts');

// ── 6. possible unrecorded substitutions ────────────────────────────────────
console.log('\n6. substitution screen');
const dev = await q(`
  SELECT b.bowlerName, s.incomingAvg, s.scratchSeries/3.0 night
  FROM scores s JOIN bowlers b ON b.bowlerID=s.bowlerID
  WHERE s.seasonID=${SEASON} AND s.week=${WEEK} AND s.isPenalty=0 AND s.incomingAvg IS NOT NULL`);
const out = dev.map(r => ({ ...r, d: Number(r.night) - Number(r.incomingAvg) }))
               .filter(r => Math.abs(r.d) >= 30).sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
if (!out.length) ok('nobody more than 30 pins/game off their average');
else {
  warn(`${out.length} bowler(s) far from their average — confirm none is an unrecorded sub:`);
  out.forEach(r => console.log(`          ${r.bowlerName.padEnd(22)} avg ${r.incomingAvg}  night ${Number(r.night).toFixed(1)}  ${r.d > 0 ? '+' : ''}${r.d.toFixed(1)}`));
}

console.log(`\n${fails ? `${fails} FAILURE(S)` : 'ALL CHECKS PASSED'}${warns ? `, ${warns} warning(s)` : ''}\n`);
await pool.close();
process.exit(fails ? 1 : 0);
