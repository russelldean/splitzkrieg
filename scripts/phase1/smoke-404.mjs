// Systematic 404 smoke test. Derives every expected public URL from the DB and
// crawls a target base URL, reporting any non-200.
//
// Usage:
//   node scripts/phase1/smoke-404.mjs [baseUrl] [--tier=all|current|historical|static] [--concurrency=N]
//
// Env:
//   SMOKE_BASE           override base url (default https://splitzkrieg.com)
//   MAINTENANCE_BYPASS   if set, appended as ?bypass=<token> so the crawl can
//                        see real pages behind the maintenance 503 wall
//
// SAFETY: production today is fully static (Batch A) so crawling everything is
// cheap. AFTER cutover, historical pages render ON DEMAND (each ~14 DB queries).
// Use --tier=current post-cutover for the safe/fast set; crawl historical only
// in deliberate throttled batches.
import sql from 'mssql';
import { readFileSync } from 'fs';

const env = readFileSync('.env.local', 'utf8');
for (const line of env.split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim();
}

const args = process.argv.slice(2);
const baseArg = args.find((a) => !a.startsWith('--'));
const BASE = (baseArg || process.env.SMOKE_BASE || 'https://splitzkrieg.com').replace(/\/$/, '');
const tier = (args.find((a) => a.startsWith('--tier=')) || '--tier=all').split('=')[1];
const CONCURRENCY = Number((args.find((a) => a.startsWith('--concurrency=')) || '--concurrency=12').split('=')[1]);
const BYPASS = process.env.MAINTENANCE_BYPASS || '';

const dbConfig = {
  server: process.env.AZURE_SQL_SERVER,
  database: process.env.AZURE_SQL_DATABASE,
  user: process.env.AZURE_SQL_USER,
  password: process.env.AZURE_SQL_PASSWORD,
  options: { encrypt: true, trustServerCertificate: false },
};

const STATIC_PATHS = [
  '/', '/about', '/blog', '/bowlers', '/join', '/leaderboards', '/lineups',
  '/lucky-strikes', '/milestones', '/resources', '/rules', '/seasons', '/specs',
  '/splitzkrieg-shares', '/stats', '/stats/all-time',
  '/stats/all-time/career-leaderboard', '/stats/all-time/game-profiles',
  '/stats/all-time/high-game-record', '/stats/all-time/individual-champions',
  '/stats/all-time/team-championships', '/teams', '/teams/network',
  '/teams/network/historical', '/teams/network/top', '/village-lanes', '/week',
];

const PLAYOFF_SETUP_SQL = `
  SELECT DISTINCT seasonID, round_num AS round FROM (
    SELECT seasonID, CASE round WHEN 'semifinal' THEN 1 WHEN 'final' THEN 2 ELSE NULL END AS round_num
    FROM playoffResults WHERE playoffType = 'Team'
    UNION ALL SELECT seasonID, round FROM individualPlayoffParticipants
    UNION ALL SELECT seasonID, round FROM playoffScores
  ) src WHERE round_num IS NOT NULL
`;

async function buildUrls(pool) {
  const urls = []; // { url, type, tier }
  const add = (url, type, t) => urls.push({ url, type, tier: t });

  // seasonID -> { slug, current }
  const seasons = (await pool.request().query(
    `SELECT seasonID, LOWER(REPLACE(displayName,' ','-')) slug, isCurrentSeason FROM seasons`
  )).recordset;
  const seasonById = new Map(seasons.map((s) => [s.seasonID, s]));

  for (const s of seasons) {
    const t = s.isCurrentSeason ? 'current' : 'historical';
    add(`/season/${s.slug}`, 'season', t);
    add(`/stats/${s.slug}`, 'stats', t);
  }

  const bowlers = (await pool.request().query(`
    SELECT b.slug, MAX(CASE WHEN se.isCurrentSeason=1 THEN 1 ELSE 0 END) isCurrent
    FROM bowlers b
    LEFT JOIN scores sc ON sc.bowlerID=b.bowlerID
    LEFT JOIN seasons se ON se.seasonID=sc.seasonID
    WHERE b.slug IS NOT NULL GROUP BY b.slug`)).recordset;
  for (const b of bowlers) add(`/bowler/${b.slug}`, 'bowler', b.isCurrent ? 'current' : 'historical');

  const teams = (await pool.request().query(`
    SELECT t.slug, MAX(CASE WHEN se.isCurrentSeason=1 THEN 1 ELSE 0 END) isCurrent
    FROM teams t
    LEFT JOIN schedule sch ON (sch.team1ID=t.teamID OR sch.team2ID=t.teamID)
    LEFT JOIN seasons se ON se.seasonID=sch.seasonID
    WHERE t.slug IS NOT NULL GROUP BY t.slug`)).recordset;
  for (const t of teams) add(`/team/${t.slug}`, 'team', t.isCurrent ? 'current' : 'historical');

  const weeks = (await pool.request().query(`
    SELECT DISTINCT se.seasonID, se.isCurrentSeason, x.week
    FROM seasons se
    JOIN (SELECT seasonID,week FROM scores WHERE isPenalty=0 UNION SELECT seasonID,week FROM schedule) x
      ON x.seasonID=se.seasonID`)).recordset;
  for (const w of weeks) {
    const s = seasonById.get(w.seasonID);
    if (!s) continue;
    add(`/week/${s.slug}/${w.week}`, 'week', w.isCurrentSeason ? 'current' : 'historical');
  }

  const playoffs = (await pool.request().query(PLAYOFF_SETUP_SQL)).recordset;
  for (const p of playoffs) {
    const s = seasonById.get(p.seasonID);
    if (!s) continue;
    add(`/playoffs/${s.slug}/${p.round}`, 'playoff', s.isCurrentSeason ? 'current' : 'historical');
  }

  for (const p of STATIC_PATHS) add(p, 'static', 'static');

  return urls;
}

async function crawl(urls) {
  const results = [];
  let i = 0;
  async function worker() {
    while (i < urls.length) {
      const idx = i++;
      const item = urls[idx];
      let full = BASE + item.url;
      if (BYPASS) full += (full.includes('?') ? '&' : '?') + 'bypass=' + encodeURIComponent(BYPASS);
      let status = 0;
      try {
        const res = await fetch(full, { redirect: 'follow', signal: AbortSignal.timeout(30000) });
        status = res.status;
      } catch (e) {
        status = e.name === 'TimeoutError' ? 599 : 598;
      }
      results.push({ ...item, status });
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return results;
}

async function main() {
  const pool = await new sql.ConnectionPool(dbConfig).connect();
  let urls = await buildUrls(pool);
  await pool.close();

  if (tier !== 'all') urls = urls.filter((u) => u.tier === tier);

  console.log(`Base: ${BASE}${BYPASS ? '  (bypass token supplied)' : ''}`);
  console.log(`Tier: ${tier}   URLs: ${urls.length}   Concurrency: ${CONCURRENCY}\n`);

  const results = await crawl(urls);
  const bad = results.filter((r) => r.status !== 200).sort((a, b) => a.url.localeCompare(b.url));

  const byStatus = {};
  for (const r of results) byStatus[r.status] = (byStatus[r.status] || 0) + 1;
  console.log('Status counts:', JSON.stringify(byStatus));

  const badByTier = { current: 0, historical: 0, static: 0 };
  for (const r of bad) badByTier[r.tier]++;
  console.log('Non-200 by tier:', JSON.stringify(badByTier));

  if (bad.length) {
    console.log(`\n${bad.length} NON-200 URL(s):`);
    for (const r of bad) console.log(`  ${r.status}  [${r.tier}/${r.type}]  ${r.url}`);
  } else {
    console.log('\nAll URLs returned 200.');
  }

  // Critical signal: current-season pages must all be 200.
  const currentBad = bad.filter((r) => r.tier === 'current');
  console.log(`\nCURRENT-SEASON non-200: ${currentBad.length}${currentBad.length ? ' (MUST be 0 after cutover)' : ''}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
