// Throwaway profiler: proves the new batched team-view read (8 statements, one
// mssql request) is a single round-trip, and that the N+1-fixing all-season
// bowlers query (statement 8) produces identical rows to the legacy
// per-season GET_TEAM_SEASON_BOWLERS_SQL path it replaces.
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
  ...extractSql('src/lib/queries/teams/roster.ts'),
  ...extractSql('src/lib/queries/teams/history.ts'),
  ...extractSql('src/lib/queries/teams/h2h.ts'),
  ...extractSql('src/lib/queries/teams/profile.ts'),
  ...extractSql('src/lib/views/team-page.ts'),
};

const REQUIRED = [
  'GET_TEAM_CURRENT_ROSTER_SQL', 'GET_TEAM_ALL_TIME_ROSTER_SQL', 'GET_TEAM_SEASON_BOWLERS_SQL',
  'GET_TEAM_SEASON_BY_SEASON_SQL', 'GET_TEAM_FRANCHISE_HISTORY_SQL',
  'GET_TEAM_H2H_SQL', 'GET_TEAM_PLAYOFF_H2H_SQL',
  'GET_TEAM_CURRENT_STANDING_SQL',
  'GET_TEAM_ALL_SEASON_BOWLERS_SQL',
];
for (const name of REQUIRED) {
  if (!consts[name]) { console.error(`FATAL: could not extract ${name}`); await pool.close(); process.exit(1); }
}

// Batch order MUST match src/lib/views/team-page.ts TEAM_VIEW_BATCH_SQL / assembleTeamView.
const BATCH_NAMES = [
  'GET_TEAM_CURRENT_ROSTER_SQL',      // 0 currentRoster
  'GET_TEAM_SEASON_BY_SEASON_SQL',    // 1 teamSeasons
  'GET_TEAM_ALL_TIME_ROSTER_SQL',     // 2 allTimeRoster
  'GET_TEAM_FRANCHISE_HISTORY_SQL',   // 3 franchiseHistory
  'GET_TEAM_CURRENT_STANDING_SQL',    // 4 currentStanding
  'GET_TEAM_H2H_SQL',                 // 5 h2hMatchups
  'GET_TEAM_PLAYOFF_H2H_SQL',         // 6 playoffH2H
  'GET_TEAM_ALL_SEASON_BOWLERS_SQL',  // 7 allSeasonBowlers (N+1 fix)
];
const BATCH_SQL = BATCH_NAMES.map((n) => consts[n]).join(';\n');

// ── Pick sample teams: most-seasons (biggest N+1 win), a mid team, Ghost Team ──
const seasonCounts = (await pool.request().query(
  `SELECT sc.teamID, t.teamName, t.slug, COUNT(DISTINCT sc.seasonID) seasons
   FROM scores sc JOIN teams t ON t.teamID=sc.teamID
   WHERE sc.isPenalty=0 AND sc.teamID <> 45
   GROUP BY sc.teamID, t.teamName, t.slug
   ORDER BY COUNT(DISTINCT sc.seasonID) DESC`
)).recordset;

// Ghost Team (45) has only isPenalty=1 rows (it's the forfeit placeholder), so it
// never shows up in an isPenalty=0 season-count scan. Pull it directly by teamID
// and report 0 real seasons (correct: GET_TEAM_SEASON_BY_SEASON_SQL also filters
// isPenalty=0, so N=0 for this team is the real answer, not a query bug).
const ghostTeamRow = (await pool.request().query(
  `SELECT teamID, teamName, slug FROM teams WHERE teamID = 45`
)).recordset[0];
const ghostRow = { ...ghostTeamRow, seasons: 0 };

const mostSeasons = seasonCounts[0];
const midTeam = seasonCounts[Math.floor(seasonCounts.length / 2)];

const samples = [
  { label: 'most-seasons', ...mostSeasons },
  { label: 'mid', ...midTeam },
  { label: 'ghost', ...ghostRow },
];

console.log('Sampled teams:');
for (const s of samples) console.log(`  [${s.label}] ${s.teamName} (id ${s.teamID}, slug ${s.slug}, ${s.seasons} seasons)`);
console.log('');

// ── Per-team measurement ─────────────────────────────────────────────────────
function groupBySeasonID(rows) {
  const out = new Map();
  for (const r of rows) {
    const { seasonID, ...bowler } = r;
    if (!out.has(seasonID)) out.set(seasonID, []);
    out.get(seasonID).push(bowler);
  }
  return out;
}

function fieldsEqual(a, b) {
  const numA = a == null ? null : Number(a);
  const numB = b == null ? null : Number(b);
  return numA === numB;
}

const teamResults = [];

for (const s of samples) {
  console.log(`── ${s.label}: ${s.teamName} (id ${s.teamID}, slug ${s.slug}) ──────────────────────`);

  // (a) Batched read: one request, 8 statements, best of 2 runs.
  let batchedMs = Infinity;
  let batchResult = null;
  for (let i = 0; i < 2; i++) {
    const t = Date.now();
    const r = await pool.request().input('teamID', s.teamID).query(BATCH_SQL);
    const elapsed = Date.now() - t;
    if (elapsed < batchedMs) { batchedMs = elapsed; batchResult = r; }
  }
  const recordsetCount = batchResult.recordsets.length;
  const roundTripPass = recordsetCount === 8;
  console.log(`  Batched read:     ${String(batchedMs).padStart(5)}ms   recordsets=${recordsetCount}  [${roundTripPass ? 'PASS' : 'FAIL'} one-round-trip, expected 8]`);

  const teamSeasonsRows = batchResult.recordsets[1]; // GET_TEAM_SEASON_BY_SEASON_SQL rows: {seasonID, ...}
  const seasonIDs = teamSeasonsRows.map((r) => r.seasonID);
  const N = seasonIDs.length;

  // (b) Legacy round-trip count + timing: 7 base queries once each + N per-season
  // bowler queries (the query the new statement 8 replaces).
  let legacySum = 0;
  const baseNames = BATCH_NAMES.filter((n) => n !== 'GET_TEAM_ALL_SEASON_BOWLERS_SQL');
  for (const name of baseNames) {
    const t = Date.now();
    await pool.request().input('teamID', s.teamID).query(consts[name]);
    legacySum += Date.now() - t;
  }
  for (const seasonID of seasonIDs) {
    const t = Date.now();
    await pool.request().input('teamID', s.teamID).input('seasonID', seasonID).query(consts.GET_TEAM_SEASON_BOWLERS_SQL);
    legacySum += Date.now() - t;
  }
  const legacyRoundTrips = 7 + N;
  console.log(`  Legacy sum:       ${String(legacySum).padStart(5)}ms   round-trips = 7 + N = 7 + ${N} = ${legacyRoundTrips}`);
  console.log(`  Round-trip cut:   1 vs ${legacyRoundTrips}  (${legacyRoundTrips}x fewer round-trips)`);
  const speedup = legacySum / Math.max(batchedMs, 1);
  console.log(`  Speedup:          ${speedup.toFixed(2)}x  (legacy ${legacySum}ms vs batched ${batchedMs}ms)`);

  // (c) N+1 correctness: statement 8 (recordsets[7]) grouped by seasonID vs the
  // OLD per-season query, row-for-row, for every season the team played.
  const allSeasonRows = batchResult.recordsets[7];
  const grouped = groupBySeasonID(allSeasonRows);

  let allSeasonsMatch = true;
  const mismatches = [];

  for (const seasonID of seasonIDs) {
    const newRows = grouped.get(seasonID) ?? [];
    const oldResult = await pool.request().input('teamID', s.teamID).input('seasonID', seasonID).query(consts.GET_TEAM_SEASON_BOWLERS_SQL);
    const oldRows = oldResult.recordset;

    if (newRows.length !== oldRows.length) {
      allSeasonsMatch = false;
      mismatches.push(`season ${seasonID}: row count mismatch (new=${newRows.length} old=${oldRows.length})`);
      continue;
    }
    for (let i = 0; i < oldRows.length; i++) {
      const nr = newRows[i];
      const or = oldRows[i];
      if (
        nr.bowlerID !== or.bowlerID ||
        !fieldsEqual(nr.gamesBowled, or.gamesBowled) ||
        !fieldsEqual(nr.totalPins, or.totalPins) ||
        !fieldsEqual(nr.average, or.average)
      ) {
        allSeasonsMatch = false;
        mismatches.push(
          `season ${seasonID} row ${i}: bowlerID new=${nr.bowlerID} old=${or.bowlerID}, ` +
          `gamesBowled new=${nr.gamesBowled} old=${or.gamesBowled}, ` +
          `totalPins new=${nr.totalPins} old=${or.totalPins}, ` +
          `average new=${nr.average} old=${or.average}`
        );
      }
    }
  }

  console.log(`  N+1 correctness: ${allSeasonsMatch ? 'PASS' : 'FAIL'}  (checked ${N} season${N === 1 ? '' : 's'}, ${allSeasonRows.length} total bowler-season rows)`);
  if (!allSeasonsMatch) {
    for (const m of mismatches) console.log(`    MISMATCH: ${m}`);
  }
  console.log('');

  teamResults.push({
    label: s.label, teamName: s.teamName, teamID: s.teamID, seasons: N,
    batchedMs, legacySum, legacyRoundTrips, speedup, roundTripPass, allSeasonsMatch,
  });
}

// ── Final summary ─────────────────────────────────────────────────────────
console.log('══ SUMMARY ═══════════════════════════════════════════════════════════════');
for (const r of teamResults) {
  console.log(`  [${r.label}] ${r.teamName} (id ${r.teamID}, ${r.seasons} seasons)`);
  console.log(`    batched=${r.batchedMs}ms (1 round-trip)  vs  legacy=${r.legacySum}ms (${r.legacyRoundTrips} round-trips = 7+${r.seasons})  speedup=${r.speedup.toFixed(2)}x`);
  console.log(`    one-round-trip check: ${r.roundTripPass ? 'PASS' : 'FAIL'}   N+1 correctness: ${r.allSeasonsMatch ? 'PASS' : 'FAIL'}`);
}
const allRoundTripPass = teamResults.every((r) => r.roundTripPass);
const allCorrectnessPass = teamResults.every((r) => r.allSeasonsMatch);
console.log(`\n  All one-round-trip checks: ${allRoundTripPass ? 'PASS' : 'FAIL'}`);
console.log(`  All N+1 correctness checks: ${allCorrectnessPass ? 'PASS' : 'FAIL'}`);

await pool.close();
