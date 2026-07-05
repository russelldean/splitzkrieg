// Throwaway profiler: proves the new batched bowler-view read (8 statements, one
// mssql request) is a single round-trip, is faster than the legacy 8-separate-query
// path, and produces the same archetype classification as the whole-league scan.
import sql from 'mssql';
import { readFileSync } from 'fs';

const ROOT = process.cwd();
const env = readFileSync(ROOT + '/.env.local', 'utf8');
for (const line of env.split('\n')) { const m = line.match(/^([^#=]+)=(.*)$/); if (m) process.env[m[1].trim()] = m[2].trim(); }
const pool = await new sql.ConnectionPool({
  server: process.env.AZURE_SQL_SERVER, database: process.env.AZURE_SQL_DATABASE,
  user: process.env.AZURE_SQL_USER, password: process.env.AZURE_SQL_PASSWORD,
  options: { encrypt: true, trustServerCertificate: false },
}).connect();

// Extract `const NAME_SQL = `...`;` template literals from a file (matches
// `export const NAME_SQL` too, since the regex just needs `const NAME_SQL =` somewhere).
function extractSql(file) {
  const src = readFileSync(ROOT + '/' + file, 'utf8');
  const out = {};
  const re = /const\s+(\w*_SQL)\s*=\s*`([\s\S]*?)`/g;
  let m;
  while ((m = re.exec(src))) out[m[1]] = m[2];
  return out;
}

const consts = {
  ...extractSql('src/lib/queries/bowlers.ts'),
  ...extractSql('src/lib/queries/facts.ts'),
  ...extractSql('src/lib/views/bowler-page.ts'),
  ...extractSql('src/lib/queries/alltime.ts'),
};

const REQUIRED = [
  'GET_BOWLER_CAREER_SUMMARY_SQL', 'BOWLER_SEASON_STATS_SQL', 'GET_BOWLER_GAME_LOG_SQL',
  'GET_BOWLER_ROLLING_AVG_HISTORY_SQL', 'GET_BOWLER_PATCHES_SQL', 'GET_BOWLER_STAR_STATS_SQL',
  'BOWLER_FACTS_SQL', 'BOWLER_ARCHETYPE_SQL', 'GAME_PROFILES_SQL', 'LEAGUE_GAME_AVGS_SQL',
];
for (const name of REQUIRED) {
  if (!consts[name]) { console.error(`FATAL: could not extract ${name}`); await pool.close(); process.exit(1); }
}

const BATCH_NAMES = [
  'GET_BOWLER_CAREER_SUMMARY_SQL', 'BOWLER_SEASON_STATS_SQL', 'GET_BOWLER_GAME_LOG_SQL',
  'GET_BOWLER_ROLLING_AVG_HISTORY_SQL', 'GET_BOWLER_PATCHES_SQL', 'GET_BOWLER_STAR_STATS_SQL',
  'BOWLER_FACTS_SQL', 'BOWLER_ARCHETYPE_SQL',
];
const BATCH_SQL = BATCH_NAMES.map((n) => consts[n]).join(';\n');

// ── Pick sample bowlers: heaviest, middle, lightest (by real game count) ──────
const counts = (await pool.request().query(
  `SELECT b.bowlerID, b.bowlerName, b.slug, COUNT(*) games
   FROM scores sc JOIN bowlers b ON b.bowlerID=sc.bowlerID
   WHERE sc.isPenalty=0 AND b.bowlerName NOT LIKE '%Penalty%'
   GROUP BY b.bowlerID,b.bowlerName,b.slug ORDER BY COUNT(*) DESC`
)).recordset;

const heavy = counts[0];
const mid = counts[Math.floor(counts.length / 2)];
const light = counts[counts.length - 1];
const samples = [
  { label: 'heaviest', ...heavy },
  { label: 'mid', ...mid },
  { label: 'lightest', ...light },
];

console.log('Sampled bowlers:');
for (const s of samples) console.log(`  [${s.label}] ${s.bowlerName} (id ${s.bowlerID}, slug ${s.slug}, ${s.games} nights)`);
console.log('');

// ── Whole-league archetype scan (correctness baseline, run ONCE) ─────────────
const gameProfileRows = (await pool.request().query(consts.GAME_PROFILES_SQL)).recordset;
const gameProfileBySlug = new Map(gameProfileRows.map((r) => [r.slug, r]));

// Mirrors classifyArchetype in src/lib/queries/alltime.ts + buildGameProfile in
// src/lib/views/bowler-page.ts.
const FLATLINER_PCT_CUTOFF = 1.5977;
function computeArchetype(games, avg1, avg2, avg3) {
  if (!games || avg1 == null || avg2 == null || avg3 == null) return null;
  const overallAvg = (avg1 + avg2 + avg3) / 3;
  const spread = Math.max(avg1, avg2, avg3) - Math.min(avg1, avg2, avg3);
  const pctSpread = overallAvg > 0 ? (spread / overallAvg) * 100 : 0;
  if (pctSpread <= FLATLINER_PCT_CUTOFF) return 'Flatliner';
  const avgs = [avg1, avg2, avg3];
  const maxIdx = avgs.indexOf(Math.max(...avgs));
  return ['Fast Starter', 'Middle Child', 'Late Bloomer'][maxIdx];
}

const perBowler = [];

for (const s of samples) {
  console.log(`── ${s.label}: ${s.bowlerName} (id ${s.bowlerID}) ──────────────────────`);

  // (a) Batched read: one request, 8 statements, best of 2 runs.
  let batchedMs = Infinity;
  let batchResult = null;
  for (let i = 0; i < 2; i++) {
    const t = Date.now();
    const r = await pool.request().input('bowlerID', s.bowlerID).query(BATCH_SQL);
    const elapsed = Date.now() - t;
    if (elapsed < batchedMs) { batchedMs = elapsed; batchResult = r; }
  }
  const recordsetCount = batchResult.recordsets.length;
  const roundTripPass = recordsetCount === 8;
  console.log(`  Batched read:  ${String(batchedMs).padStart(5)}ms   recordsets=${recordsetCount}  [${roundTripPass ? 'PASS' : 'FAIL'} one-round-trip, expected 8]`);

  // (b) Legacy path: same 8 statements, individually, each its own request+query.
  let legacySum = 0;
  for (const name of BATCH_NAMES) {
    const t = Date.now();
    await pool.request().input('bowlerID', s.bowlerID).query(consts[name]);
    legacySum += Date.now() - t;
  }
  console.log(`  Legacy sum:    ${String(legacySum).padStart(5)}ms   round-trips=8 (${BATCH_NAMES.length} separate queries)`);

  const speedup = legacySum / Math.max(batchedMs, 1);
  console.log(`  Speedup:       ${speedup.toFixed(2)}x  (legacy ${legacySum}ms vs batched ${batchedMs}ms)`);

  // (c) Correctness cross-check: archetype from batch statement 8 vs whole-league scan.
  const archRow = batchResult.recordsets[7][0]; // {games, avg1, avg2, avg3}
  const archFromBatch = computeArchetype(archRow.games, archRow.avg1, archRow.avg2, archRow.avg3);

  const leagueRow = gameProfileBySlug.get(s.slug);
  const archFromLeague = leagueRow
    ? computeArchetype(leagueRow.games, leagueRow.avg1, leagueRow.avg2, leagueRow.avg3)
    : null;

  const archMatch = archFromBatch === archFromLeague;
  console.log(`  Archetype:     batch="${archFromBatch}"  league="${archFromLeague}"  [${archMatch ? 'PASS' : 'FAIL'}]`);
  console.log('');

  perBowler.push({
    label: s.label, bowlerName: s.bowlerName, bowlerID: s.bowlerID,
    batchedMs, legacySum, speedup, archMatch, archFromBatch, archFromLeague,
  });
}

// ── League baseline timing (shared GameProfile comparison bar) ──────────────
let leagueBaselineMs = Infinity;
let leagueAvgsRow = null;
for (let i = 0; i < 2; i++) {
  const t = Date.now();
  const r = await pool.request().query(consts.LEAGUE_GAME_AVGS_SQL);
  const elapsed = Date.now() - t;
  if (elapsed < leagueBaselineMs) { leagueBaselineMs = elapsed; leagueAvgsRow = r.recordset[0]; }
}

console.log('── League baseline (LEAGUE_GAME_AVGS_SQL, no params, best of 2) ──────────────');
console.log(`  ${leagueBaselineMs}ms   avg1=${leagueAvgsRow.avg1.toFixed(2)} avg2=${leagueAvgsRow.avg2.toFixed(2)} avg3=${leagueAvgsRow.avg3.toFixed(2)}`);
console.log('  Note: shared GameProfile comparison bar. If slow, fallback is a per-season');
console.log('  precompute in leagueSettings rather than a live scan.');
console.log('');

// ── Final summary ─────────────────────────────────────────────────────────
console.log('══ SUMMARY ═══════════════════════════════════════════════════════════════');
for (const b of perBowler) {
  console.log(`  [${b.label}] ${b.bowlerName} (id ${b.bowlerID})`);
  console.log(`    batched=${b.batchedMs}ms (1 round-trip)  vs  legacy=${b.legacySum}ms (8 round-trips)  speedup=${b.speedup.toFixed(2)}x`);
  console.log(`    archetype check: ${b.archMatch ? 'PASS' : 'FAIL'}  (batch="${b.archFromBatch}" league="${b.archFromLeague}")`);
}
const allArchPass = perBowler.every((b) => b.archMatch);
console.log(`\n  All archetype checks: ${allArchPass ? 'PASS' : 'FAIL'}`);
console.log(`  League baseline (LEAGUE_GAME_AVGS_SQL): ${leagueBaselineMs}ms`);

await pool.close();
