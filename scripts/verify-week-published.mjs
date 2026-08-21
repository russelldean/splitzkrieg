#!/usr/bin/env node
/**
 * Verify a published week is actually live on the site.
 *
 * Every check asserts a value that CHANGES WEEK TO WEEK, read from the database
 * and then looked for in the served HTML. That is the whole point: a stale page
 * serves last week's numbers, so only a week-specific value can tell you the
 * publish landed.
 *
 * Rewritten 2026-08-20. The previous version hardcoded season XXXV in two
 * places, so after the S36 changeover it checked the wrong season and passed
 * anyway. It also leaned on `html.length > 5000`, which only proves a page
 * loaded: a non-existent week 99 passed 3 of its 5 checks. Nothing here may use
 * page length as a test, and nothing may hardcode a season.
 *
 * Usage:
 *   node scripts/verify-week-published.mjs --week=3
 *   node scripts/verify-week-published.mjs --week=3 --season=fall-2026
 *   node scripts/verify-week-published.mjs --week=3 --team=lucky-strikes
 *
 * Exit code 0 if all checks pass, 1 if any fail.
 */
import sql from 'mssql';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const getArg = (p) => args.find((a) => a.startsWith(p))?.replace(p, '') ?? null;

const week = parseInt(getArg('--week='), 10);
const seasonArg = getArg('--season=');
const teamSlug = getArg('--team=');
const baseUrl = getArg('--base=') ?? 'https://splitzkrieg.com';

if (!week || isNaN(week)) {
  console.error(
    'Usage: node scripts/verify-week-published.mjs --week=N [--season=slug] [--team=slug] [--base=url]',
  );
  process.exit(1);
}

const env = readFileSync(resolve(ROOT, '.env.local'), 'utf8');
for (const l of env.split('\n')) {
  const m = l.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim();
}

const pool = await sql.connect({
  server: process.env.AZURE_SQL_SERVER,
  database: process.env.AZURE_SQL_DATABASE,
  user: process.env.AZURE_SQL_USER,
  password: process.env.AZURE_SQL_PASSWORD,
  options: {
    encrypt: true,
    trustServerCertificate: false,
    connectTimeout: 60000,
    requestTimeout: 60000,
  },
});

/* Season comes from the database, never from a constant. A hardcoded season is
   what made the old version pass against XXXV for a whole changeover. */
const seasonRow = seasonArg
  ? (
      await pool
        .request()
        .input('slug', seasonArg)
        .query(
          `SELECT seasonID, romanNumeral, LOWER(REPLACE(displayName,' ','-')) AS slug
           FROM seasons WHERE LOWER(REPLACE(displayName,' ','-')) = @slug`,
        )
    ).recordset[0]
  : (
      await pool.request().query(
        `SELECT TOP 1 seasonID, romanNumeral, LOWER(REPLACE(displayName,' ','-')) AS slug
         FROM seasons WHERE isCurrentSeason = 1`,
      )
    ).recordset[0];

if (!seasonRow) {
  console.error(seasonArg ? `No season with slug "${seasonArg}"` : 'No current season');
  await pool.close();
  process.exit(1);
}

/* The week's top scratch series: a bowler name and a number that both change
   every week, so finding them proves the page is not serving a stale render. */
const top = (
  await pool
    .request()
    .input('s', seasonRow.seasonID)
    .input('w', week)
    .query(
      `SELECT TOP 1 b.bowlerName, b.slug, sc.scratchSeries
       FROM scores sc JOIN bowlers b ON b.bowlerID = sc.bowlerID
       WHERE sc.seasonID = @s AND sc.week = @w AND sc.isPenalty = 0
       ORDER BY sc.scratchSeries DESC`,
    )
).recordset[0];

if (!top) {
  console.error(
    `No scores for ${seasonRow.slug} week ${week}. Nothing to verify: import the week first.`,
  );
  await pool.close();
  process.exit(1);
}

/* Old recap URLs are in every weekly email ever sent, so they must keep
   resolving. Only checked when a post actually exists for this week. */
const post = (
  await pool
    .request()
    .input('s', seasonRow.romanNumeral)
    .input('w', week)
    .query(
      `SELECT TOP 1 slug FROM blogPosts
       WHERE seasonRomanNumeral = @s AND week = @w AND isPublished = 1`,
    )
).recordset[0];

await pool.close();

const series = String(top.scratchSeries);
const weekPath = `/week/${seasonRow.slug}/${week}`;

/* Checks are labelled by what they actually prove, because the version this
   replaced blurred the two and that is how it passed for a whole changeover.

     FRESH  - asserts something only true once THIS week's data is live. These
              are the checks that can catch a stale cache.
     REACH  - asserts a page renders or a URL resolves. Useful, but a stale page
              passes these, so they can never stand in for a FRESH check. */
const checks = [
  {
    kind: 'FRESH',
    name: 'Homepage: published-week pointer',
    url: `${baseUrl}/`,
    expect: `"Week ${week}"`,
    test: (h) => new RegExp(`week\\s*${week}\\b`, 'i').test(h),
    feedsOn: ['getCurrentSeasonSnapshot', 'getWeeklyHighlights'],
  },
  {
    kind: 'FRESH',
    // The real state change a publish causes: the week page stops showing a
    // matchup preview and starts showing results. Verified by diffing a played
    // week against an upcoming one; these three markers separate them cleanly.
    name: 'Week page: results, not a preview',
    url: `${baseUrl}${weekPath}`,
    expect: '"Weekly Highlights" and "Bowler of the Week", and no "Matchups"',
    test: (h) =>
      h.includes('Weekly Highlights') &&
      h.includes('Bowler of the Week') &&
      !h.includes('Matchups'),
    feedsOn: ['getWeekScores', 'getSeasonMatchResults', 'getWeekCareerMilestones'],
  },
  {
    kind: 'FRESH',
    // The bowler page holds one row per week, so this bowler's exact series for
    // THIS week is genuinely week-specific. The same number on the week page is
    // NOT: a page dense with bowling scores contains almost any 3-digit value
    // by coincidence, which a mutation test confirmed.
    name: `Bowler page (${top.slug}): week ${week} series`,
    url: `${baseUrl}/bowler/${top.slug}`,
    expect: `their ${series} series`,
    test: (h) => new RegExp(`\\b${series}\\b`).test(h),
    feedsOn: ['getBowlerPageView'],
  },
  {
    kind: 'REACH',
    name: 'Week page: standings + leaderboard',
    url: `${baseUrl}${weekPath}`,
    expect: 'both sections rendered',
    test: (h) => h.includes('Standings') && h.includes('Leaderboard'),
    feedsOn: ['getStandingsSnapshot', 'getLeaderboardSnapshot'],
  },
  {
    kind: 'REACH',
    name: `Season page (${seasonRow.slug})`,
    url: `${baseUrl}/season/${seasonRow.slug}`,
    expect: `a link to week ${week}`,
    test: (h) => h.includes(weekPath),
    feedsOn: ['getSeasonStandings', 'getSeasonWeekSummaries'],
  },
];

if (post) {
  checks.push({
    kind: 'REACH',
    // Old recap URLs are in every weekly email ever sent. Not a freshness
    // signal, but a regression that would be silent and expensive.
    name: 'Old recap URL still resolves',
    url: `${baseUrl}/blog/${post.slug}`,
    expect: `a redirect through to ${weekPath}`,
    test: (h) => h.includes('Weekly Highlights') || h.includes('Bowler of the Week'),
    feedsOn: ['weekPathForPost redirect'],
  });
}

if (teamSlug) {
  checks.push({
    kind: 'REACH',
    name: `Team page (${teamSlug})`,
    url: `${baseUrl}/team/${teamSlug}`,
    expect: `a link to week ${week}`,
    test: (h) => h.includes(weekPath),
    feedsOn: ['getTeamPageView', 'getTeamCurrentSeasonSchedule'],
  });
}

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Splitzkrieg-VerifyScript/1.0' },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return await res.text();
}

console.log(
  `\nVerifying ${seasonRow.slug} (${seasonRow.romanNumeral}) week ${week} on ${baseUrl}`,
);
console.log(`Week-specific marker: ${top.bowlerName} ${series} scratch series\n`);
console.log('-'.repeat(80));

let passed = 0;
let failed = 0;

for (const check of checks) {
  process.stdout.write(`${check.kind}  ${check.name.padEnd(42)} `);
  try {
    const html = await fetchHtml(check.url);
    if (check.test(html)) {
      console.log('PASS');
      passed++;
    } else {
      console.log('FAIL');
      console.log(`  URL:      ${check.url}`);
      console.log(`  Expected: ${check.expect}`);
      console.log(`  Feeds:    ${check.feedsOn.join(', ')}`);
      failed++;
    }
  } catch (err) {
    console.log('ERROR');
    console.log(`  URL:   ${check.url}`);
    console.log(`  Error: ${err.message}`);
    failed++;
  }
}

console.log('-'.repeat(80));
console.log(`\n${passed} passed, ${failed} failed of ${checks.length} checks`);

if (failed > 0) {
  console.log('\nA failure usually means a query is serving stale cache. The "Feeds" line');
  console.log('names the queries behind that page.');
  process.exit(1);
}
console.log('\nAll checks passed. Week is live.');
process.exit(0);
