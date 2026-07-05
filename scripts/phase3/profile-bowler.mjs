// Throwaway profiler: extract named *_SQL constants from the query source and
// time each bowler-page query against the live DB for the heaviest bowler.
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

// Extract `const NAME_SQL = `...`;` template literals from a file.
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
  ...extractSql('src/lib/queries/home.ts'),
  ...extractSql('src/lib/queries/milestones.ts'),
  ...extractSql('src/lib/queries/alltime.ts'),
};

// Heaviest REAL bowler (exclude the synthetic Penalty aggregate).
const heavy = (await pool.request().query(
  `SELECT TOP 1 b.bowlerID, b.bowlerName, b.slug, COUNT(*) games
   FROM scores sc JOIN bowlers b ON b.bowlerID=sc.bowlerID
   WHERE sc.isPenalty=0 AND b.bowlerName NOT LIKE '%Penalty%'
   GROUP BY b.bowlerID,b.bowlerName,b.slug ORDER BY COUNT(*) DESC`
)).recordset[0];
console.log(`Heaviest bowler: ${heavy.bowlerName} (id ${heavy.bowlerID}, slug ${heavy.slug}, ${heavy.games} games)\n`);

const currentSeasonID = (await pool.request().query(
  `SELECT TOP 1 seasonID FROM seasons WHERE isCurrentSeason=1`
)).recordset[0]?.seasonID ?? 0;

// Bowler-page-relevant SQL constants to time.
const TARGETS = [
  // bowler-specific
  'GET_BOWLER_CAREER_SUMMARY_SQL', 'BOWLER_SEASON_STATS_SQL', 'GET_BOWLER_GAME_LOG_SQL',
  'GET_BOWLER_ROLLING_AVG_HISTORY_SQL', 'GET_BOWLER_STAR_STATS_SQL', 'GET_BOWLER_PATCHES_SQL',
  'BOWLER_FACTS_SQL', 'GAME_PROFILES_SQL',
  // league-wide (recomputed per bowler today, but identical for everyone)
  'HIGHLIGHTS_SCORES_SQL', 'WEEK_MILESTONES_SQL', 'GET_RECENT_MILESTONES_SQL',
];

const results = [];
for (const name of TARGETS) {
  const q = consts[name];
  if (!q) { console.log(`(skip ${name}: not found)`); continue; }
  const req = pool.request();
  if (q.includes('@bowlerID')) req.input('bowlerID', heavy.bowlerID);
  if (q.includes('@slug')) req.input('slug', heavy.slug);
  if (q.includes('@seasonID')) req.input('seasonID', currentSeasonID);
  // time it (median of 2 runs to smooth cold effects)
  let best = Infinity, rows = 0;
  for (let i = 0; i < 2; i++) {
    const t = Date.now();
    try { const r = await req.query(q); rows = r.recordset?.length ?? 0; }
    catch (e) { console.log(`  ${name}: ERROR ${e.message.slice(0,80)}`); best = -1; break; }
    best = Math.min(best, Date.now() - t);
  }
  if (best >= 0) results.push({ name, ms: best, rows });
}

results.sort((a, b) => b.ms - a.ms);
console.log('Query timings (fastest of 2 runs), slowest first:');
for (const r of results) console.log(`  ${String(r.ms).padStart(6)}ms  rows=${String(r.rows).padStart(4)}  ${r.name}`);
console.log(`\n  TOTAL if serial: ${results.reduce((s, r) => s + r.ms, 0)}ms`);
console.log(`  MAX single query: ${Math.max(...results.map(r => r.ms))}ms`);
await pool.close();
