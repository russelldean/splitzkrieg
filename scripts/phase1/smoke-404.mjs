// Systematic 404 smoke test. Derives every expected public URL from the DB and
// crawls a target base url, reporting any non-200.
//
// SAFETY MODEL (prebuilt vs on-demand):
//   - Prebuilt pages (static + current-season season/stats/week) are served from
//     the CDN with zero DB load -> safe to crawl at any concurrency.
//   - On-demand pages (all bowler/team, historical season/stats/week, playoffs)
//     render live and fire many DB queries each. Crawling them concurrently
//     saturates the $5 DB and can BAKE cached 404s (fallback -> notFound()).
//   By default this tool crawls ONLY prebuilt pages. On-demand crawling requires
//   the explicit --include-ondemand flag and is force-throttled to concurrency 2.
//
// Usage:
//   node scripts/phase1/smoke-404.mjs [baseUrl] [--include-ondemand] [--concurrency=N]
//
// Env:
//   SMOKE_BASE           override base url (default https://splitzkrieg.com)
//   MAINTENANCE_BYPASS   if set, appended as ?bypass=<token> to see behind the wall
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
const INCLUDE_ONDEMAND = args.includes('--include-ondemand');
const reqConcurrency = Number((args.find((a) => a.startsWith('--concurrency=')) || '--concurrency=12').split('=')[1]);
// Hard cap on-demand crawling to protect the DB, regardless of --concurrency.
const CONCURRENCY = INCLUDE_ONDEMAND ? Math.min(reqConcurrency, 2) : reqConcurrency;
const TIMEOUT_MS = INCLUDE_ONDEMAND ? 90000 : 30000;
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
  const urls = []; // { url, type, prebuilt }
  const add = (url, type, prebuilt) => urls.push({ url, type, prebuilt });

  const seasons = (await pool.request().query(
    `SELECT seasonID, LOWER(REPLACE(displayName,' ','-')) slug, isCurrentSeason FROM seasons`
  )).recordset;
  const seasonById = new Map(seasons.map((s) => [s.seasonID, s]));

  // season/stats/week are prebuilt ONLY for the current season; historical = on-demand.
  for (const s of seasons) {
    add(`/season/${s.slug}`, 'season', !!s.isCurrentSeason);
    add(`/stats/${s.slug}`, 'stats', !!s.isCurrentSeason);
  }

  // bowler + team pages are always on-demand now.
  const bowlers = (await pool.request().query(
    `SELECT slug FROM bowlers WHERE slug IS NOT NULL ORDER BY slug`
  )).recordset;
  for (const b of bowlers) add(`/bowler/${b.slug}`, 'bowler', false);

  const teams = (await pool.request().query(
    `SELECT slug FROM teams WHERE slug IS NOT NULL ORDER BY slug`
  )).recordset;
  for (const t of teams) add(`/team/${t.slug}`, 'team', false);

  const weeks = (await pool.request().query(`
    SELECT DISTINCT se.seasonID, se.isCurrentSeason, x.week
    FROM seasons se
    JOIN (SELECT seasonID,week FROM scores WHERE isPenalty=0 UNION SELECT seasonID,week FROM schedule) x
      ON x.seasonID=se.seasonID`)).recordset;
  for (const w of weeks) {
    const s = seasonById.get(w.seasonID);
    if (!s) continue;
    add(`/week/${s.slug}/${w.week}`, 'week', !!w.isCurrentSeason);
  }

  const playoffs = (await pool.request().query(PLAYOFF_SETUP_SQL)).recordset;
  for (const p of playoffs) {
    const s = seasonById.get(p.seasonID);
    if (!s) continue;
    add(`/playoffs/${s.slug}/${p.round}`, 'playoff', false);
  }

  for (const p of STATIC_PATHS) add(p, 'static', true);

  return urls;
}

async function crawl(urls) {
  const results = [];
  // Send the bypass as a cookie, not a query param: it survives 307 redirects
  // (e.g. /leaderboards -> /stats) where a query param would be dropped.
  const headers = BYPASS ? { cookie: `sk_bypass=${BYPASS}` } : undefined;
  let i = 0;
  async function worker() {
    while (i < urls.length) {
      const item = urls[i++];
      const full = BASE + item.url;
      let status = 0;
      try {
        const res = await fetch(full, { redirect: 'follow', headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
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

  const prebuilt = urls.filter((u) => u.prebuilt);
  const ondemand = urls.filter((u) => !u.prebuilt);

  if (!INCLUDE_ONDEMAND) {
    urls = prebuilt;
    console.log(`Crawling ${prebuilt.length} PREBUILT pages (safe, CDN-served). Skipping ${ondemand.length} on-demand pages.`);
    console.log('Pass --include-ondemand to also crawl on-demand pages (force-throttled to protect the DB).');
  } else {
    console.log(`WARNING: crawling ${ondemand.length} ON-DEMAND pages at concurrency ${CONCURRENCY} (each fires live DB queries).`);
    console.log(`Plus ${prebuilt.length} prebuilt pages. Total ${urls.length}.`);
  }
  console.log(`Base: ${BASE}${BYPASS ? '  (bypass token supplied)' : ''}   timeout: ${TIMEOUT_MS}ms\n`);

  const results = await crawl(urls);
  const bad = results.filter((r) => r.status !== 200).sort((a, b) => a.url.localeCompare(b.url));

  const byStatus = {};
  for (const r of results) byStatus[r.status] = (byStatus[r.status] || 0) + 1;
  console.log('Status counts:', JSON.stringify(byStatus));

  const badPrebuilt = bad.filter((r) => r.prebuilt);
  console.log(`Prebuilt non-200: ${badPrebuilt.length}   On-demand non-200: ${bad.length - badPrebuilt.length}`);

  if (bad.length) {
    console.log(`\n${bad.length} NON-200 URL(s):`);
    for (const r of bad) console.log(`  ${r.status}  [${r.prebuilt ? 'prebuilt' : 'ondemand'}/${r.type}]  ${r.url}`);
  } else {
    console.log('\nAll crawled URLs returned 200.');
  }

  // Prebuilt pages MUST all be 200 (a prebuilt non-200 is a real regression).
  console.log(`\nPREBUILT non-200: ${badPrebuilt.length}${badPrebuilt.length ? ' (MUST be 0)' : ''}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
