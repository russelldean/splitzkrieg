// Systematic cold-cost audit: extracts every *_SQL constant from the query + view
// layers, times each on its FIRST single run (no best-of-N min - that hid the team
// page's 28s cold cost), ranks slowest-first, and flags anything over the budget.
// Supplies representative params (heaviest bowler/team, current season/week).
// Sequential + throttled to respect the $5 tier. Read-only.
import sql from 'mssql';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const env = readFileSync(ROOT + '/.env.local', 'utf8');
for (const line of env.split('\n')) { const m = line.match(/^([^#=]+)=(.*)$/); if (m) process.env[m[1].trim()] = m[2].trim(); }
const pool = await new sql.ConnectionPool({
  server: process.env.AZURE_SQL_SERVER, database: process.env.AZURE_SQL_DATABASE,
  user: process.env.AZURE_SQL_USER, password: process.env.AZURE_SQL_PASSWORD,
  options: { encrypt: true, trustServerCertificate: false, requestTimeout: 120000 },
}).connect();

const SLOW_MS = 1000; // flag threshold - well under the 3s prod telemetry line

// Recursively collect .ts files under a dir.
function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (e.endsWith('.ts') && !e.endsWith('.test.ts')) out.push(p);
  }
  return out;
}
// Extract `const NAME_SQL = `...`` (incl. export const) with source file.
function extractSql(file) {
  const src = readFileSync(file, 'utf8');
  const out = []; const re = /(?:export\s+)?const\s+(\w*_SQL)\s*=\s*`([\s\S]*?)`/g; let m;
  while ((m = re.exec(src))) out.push({ name: m[1], sql: m[2], file: file.replace(ROOT + '/', '') });
  return out;
}
const files = [...walk(join(ROOT, 'src/lib/queries')), ...walk(join(ROOT, 'src/lib/views'))];
const consts = files.flatMap(extractSql);

// Representative params.
const heavyBowler = (await pool.request().query(
  `SELECT TOP 1 b.bowlerID, b.slug FROM scores sc JOIN bowlers b ON b.bowlerID=sc.bowlerID
   WHERE sc.isPenalty=0 AND b.bowlerName NOT LIKE '%Penalty%'
   GROUP BY b.bowlerID, b.slug ORDER BY COUNT(*) DESC`)).recordset[0];
const heavyTeam = (await pool.request().query(
  `SELECT TOP 1 sc.teamID FROM scores sc WHERE sc.isPenalty=0 AND sc.teamID<>45
   GROUP BY sc.teamID ORDER BY COUNT(DISTINCT sc.bowlerID) DESC`)).recordset[0];
const seasonID = (await pool.request().query(`SELECT TOP 1 seasonID FROM seasons WHERE isCurrentSeason=1`)).recordset[0]?.seasonID ?? 0;
const week = (await pool.request().input('s', seasonID).query(`SELECT MAX(week) w FROM scores WHERE seasonID=@s AND isPenalty=0`)).recordset[0]?.w ?? 1;

const KNOWN = { bowlerID: heavyBowler.bowlerID, slug: heavyBowler.slug, teamID: heavyTeam.teamID, seasonID, week };
console.log(`Params: bowlerID=${KNOWN.bowlerID} slug=${KNOWN.slug} teamID=${KNOWN.teamID} seasonID=${KNOWN.seasonID} week=${KNOWN.week}`);
console.log(`Auditing ${consts.length} SQL constants (first-run cold, flag > ${SLOW_MS}ms)\n`);

const results = [];
for (const c of consts) {
  const params = [...new Set((c.sql.match(/@(\w+)/g) || []).map(p => p.slice(1)))];
  const unknown = params.filter(p => !(p in KNOWN));
  if (unknown.length) { results.push({ ...c, skip: `needs @${unknown.join(', @')}` }); continue; }
  const req = pool.request();
  for (const p of params) req.input(p, KNOWN[p]);
  const corr = (c.sql.match(/SELECT\s+TOP\s+1/gi) || []).length; // correlated-scalar-subquery heuristic
  const t0 = Date.now();
  try { const r = await req.query(c.sql); results.push({ ...c, ms: Date.now() - t0, rows: r.recordset?.length ?? 0, corr }); }
  catch (e) { results.push({ ...c, err: e.message.slice(0, 60) }); }
}

const timed = results.filter(r => r.ms != null).sort((a, b) => b.ms - a.ms);
const flagged = timed.filter(r => r.ms >= SLOW_MS);
console.log(`SLOW (>= ${SLOW_MS}ms), worst first:`);
for (const r of flagged) console.log(`  ${String(r.ms).padStart(6)}ms  rows=${String(r.rows).padStart(4)}  ${r.corr ? `[${r.corr}x TOP1] ` : ''}${r.name}  (${r.file})`);
if (!flagged.length) console.log('  (none - every audited query under 1s)');

console.log(`\nAll timed, worst first (top 15):`);
for (const r of timed.slice(0, 15)) console.log(`  ${String(r.ms).padStart(6)}ms  ${r.corr ? `[${r.corr}x TOP1] ` : ''}${r.name}  (${r.file})`);

const skipped = results.filter(r => r.skip);
const errored = results.filter(r => r.err);
console.log(`\nSkipped (unresolvable params): ${skipped.length}  |  Errored: ${errored.length}`);
for (const r of errored) console.log(`  ERR ${r.name}: ${r.err}`);
await pool.close();
