// HONEST cold profiler: times each batch statement on its FIRST single run
// (no best-of-2 min, which hid the cold cost before). Picks heavy teams that
// have NOT been loaded this session so their data pages are still cold.
import sql from 'mssql';
import { readFileSync } from 'fs';

const ROOT = process.cwd();
const env = readFileSync(ROOT + '/.env.local', 'utf8');
for (const line of env.split('\n')) { const m = line.match(/^([^#=]+)=(.*)$/); if (m) process.env[m[1].trim()] = m[2].trim(); }
const pool = await new sql.ConnectionPool({
  server: process.env.AZURE_SQL_SERVER, database: process.env.AZURE_SQL_DATABASE,
  user: process.env.AZURE_SQL_USER, password: process.env.AZURE_SQL_PASSWORD,
  options: { encrypt: true, trustServerCertificate: false, requestTimeout: 120000 },
}).connect();

function extractSql(file) {
  const src = readFileSync(ROOT + '/' + file, 'utf8');
  const out = {}; const re = /const\s+(\w*_SQL)\s*=\s*`([\s\S]*?)`/g; let m;
  while ((m = re.exec(src))) out[m[1]] = m[2];
  return out;
}
const c = {
  ...extractSql('src/lib/queries/teams/roster.ts'),
  ...extractSql('src/lib/queries/teams/history.ts'),
  ...extractSql('src/lib/queries/teams/h2h.ts'),
  ...extractSql('src/lib/queries/teams/profile.ts'),
  ...extractSql('src/lib/views/team-page.ts'),
};

// The 8 batch statements in app order, with a short label.
const STATEMENTS = [
  ['currentRoster (corr. subq)', 'GET_TEAM_CURRENT_ROSTER_SQL'],
  ['seasonByseason', 'GET_TEAM_SEASON_BY_SEASON_SQL'],
  ['allTimeRoster (corr. subq x2)', 'GET_TEAM_ALL_TIME_ROSTER_SQL'],
  ['franchiseHistory', 'GET_TEAM_FRANCHISE_HISTORY_SQL'],
  ['currentStanding', 'GET_TEAM_CURRENT_STANDING_SQL'],
  ['h2h', 'GET_TEAM_H2H_SQL'],
  ['playoffH2H', 'GET_TEAM_PLAYOFF_H2H_SQL'],
  ['allSeasonBowlers (N+1 fix)', 'GET_TEAM_ALL_SEASON_BOWLERS_SQL'],
];
const BATCH = STATEMENTS.map(([, k]) => c[k]).join(';\n');

// Heavy teams NOT loaded this session (exclude 15,18,27,45), ranked by all-time
// bowler count (drives the correlated-subquery cost).
const teams = (await pool.request().query(
  `SELECT TOP 3 sc.teamID, t.teamName, t.slug,
     COUNT(DISTINCT sc.bowlerID) allTimeBowlers, COUNT(DISTINCT sc.seasonID) seasons
   FROM scores sc JOIN teams t ON t.teamID=sc.teamID
   WHERE sc.isPenalty=0 AND sc.teamID NOT IN (15,18,27,45)
   GROUP BY sc.teamID, t.teamName, t.slug
   ORDER BY COUNT(DISTINCT sc.bowlerID) DESC`
)).recordset;

for (const t of teams) {
  console.log(`\n== ${t.teamName} (id ${t.teamID}, ${t.allTimeBowlers} all-time bowlers, ${t.seasons} seasons) ==`);
  // Per-statement FIRST-RUN cold timing.
  const rows = [];
  for (const [label, key] of STATEMENTS) {
    const q = c[key];
    const req = pool.request().input('teamID', t.teamID);
    const t0 = Date.now();
    try { await req.query(q); } catch (e) { console.log(`  ${label}: ERROR ${e.message.slice(0,70)}`); continue; }
    rows.push({ label, ms: Date.now() - t0 });
  }
  rows.sort((a, b) => b.ms - a.ms);
  for (const r of rows) console.log(`  ${String(r.ms).padStart(7)}ms  ${r.label}`);
  console.log(`  ---- sum of individual: ${rows.reduce((s, r) => s + r.ms, 0)}ms`);
  // Full batch as ONE request, FIRST run (this is what the page actually does).
  const tb = Date.now();
  const res = await pool.request().input('teamID', t.teamID).query(BATCH);
  console.log(`  BATCH (1 request, ${res.recordsets.length} recordsets): ${Date.now() - tb}ms  <-- real cold page cost`);
}
await pool.close();
