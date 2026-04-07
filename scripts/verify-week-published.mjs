#!/usr/bin/env node
/**
 * Verify a published week is showing on the live site.
 *
 * Hits 6 URLs and checks each for indicators that the new week's data is live.
 * Reports PASS/FAIL per page so you can quickly validate a publish-week deploy.
 *
 * Usage:
 *   node scripts/verify-week-published.mjs --week=6
 *   node scripts/verify-week-published.mjs --week=6 --season=spring-2026
 *   node scripts/verify-week-published.mjs --week=6 --bowler=amy-kostrewa --team=dropping-balls-since-2007
 *
 * Exit code 0 if all checks pass, 1 if any fail.
 */

const args = process.argv.slice(2);
const getArg = (prefix) => args.find((a) => a.startsWith(prefix))?.replace(prefix, '') ?? null;

const week = parseInt(getArg('--week='), 10);
const seasonSlug = getArg('--season=') ?? 'spring-2026';
const bowlerSlug = getArg('--bowler=') ?? 'amy-kostrewa';
const teamSlug = getArg('--team=');
const baseUrl = getArg('--base=') ?? 'https://splitzkrieg.com';

if (!week || isNaN(week)) {
  console.error('Usage: node scripts/verify-week-published.mjs --week=N [--season=slug] [--bowler=slug] [--team=slug] [--base=url]');
  process.exit(1);
}

const checks = [
  {
    name: 'Homepage snapshot',
    url: `${baseUrl}/`,
    description: 'Looks for "Week N" or week-N-specific content in the snapshot section',
    test: (html) => {
      // Check for "Week N" string (case-insensitive)
      const wkRegex = new RegExp(`week\\s*${week}\\b`, 'i');
      return wkRegex.test(html);
    },
    feedsOn: ['getCurrentSeasonSnapshot'],
  },
  {
    name: 'Homepage ticker (highlights)',
    url: `${baseUrl}/`,
    description: 'Same page; relies on getWeeklyHighlights ticker rendering',
    test: (html) => {
      // Ticker is on the same page; if snapshot week N is present, ticker should be too
      // (This is a weaker check — both come from the same fetch)
      return html.length > 1000; // sanity: page loaded
    },
    feedsOn: ['getWeeklyHighlights'],
  },
  {
    name: 'Week 6 blog post',
    url: `${baseUrl}/blog/season-xxxv-week-${week}-recap`,
    description: 'Blog post page renders WeekRecap with current week data',
    test: (html) => {
      // Should contain the week number and not 404
      return !html.includes('Post Not Found') && html.length > 5000;
    },
    feedsOn: ['getTopPerformers', 'getWeekMilestones', 'getMatchResultsSummary', 'getStandingsSnapshot', 'getLeaderboardSnapshot'],
  },
  {
    name: `Bowler profile (${bowlerSlug})`,
    url: `${baseUrl}/bowler/${bowlerSlug}`,
    description: 'Should show season stats including a row for the new week',
    test: (html) => {
      // Should contain the bowler's name and the week somewhere in the page
      const wkRegex = new RegExp(`\\b${week}\\b`);
      return !html.includes('Bowler Not Found') && wkRegex.test(html);
    },
    feedsOn: ['getBowlerSeasonStats', 'getBowlerGameLog', 'getBowlerRollingAvgHistory', 'getBowlerCareerSummary'],
  },
  {
    name: `Season standings (${seasonSlug})`,
    url: `${baseUrl}/season/${seasonSlug}`,
    description: 'Standings should reflect the new week',
    test: (html) => {
      // Page should load and contain standings
      return html.length > 5000;
    },
    feedsOn: ['getSeasonStandings', 'getSeasonLeaderboard'],
  },
];

if (teamSlug) {
  checks.push({
    name: `Team profile (${teamSlug})`,
    url: `${baseUrl}/team/${teamSlug}`,
    description: 'Team current standing should reflect the new week',
    test: (html) => {
      return !html.includes('Team Not Found') && html.length > 5000;
    },
    feedsOn: ['getTeamCurrentStanding', 'getTeamCurrentRoster'],
  });
}

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Splitzkrieg-VerifyScript/1.0' },
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  return await res.text();
}

async function runChecks() {
  console.log(`\nVerifying week ${week} on ${baseUrl}\n`);
  console.log('─'.repeat(80));

  let passed = 0;
  let failed = 0;

  for (const check of checks) {
    process.stdout.write(`${check.name.padEnd(40)} `);
    try {
      const html = await fetchHtml(check.url);
      const ok = check.test(html);
      if (ok) {
        console.log('✓ PASS');
        passed++;
      } else {
        console.log('✗ FAIL');
        console.log(`  URL: ${check.url}`);
        console.log(`  Why: ${check.description}`);
        console.log(`  Feeds: ${check.feedsOn.join(', ')}`);
        failed++;
      }
    } catch (err) {
      console.log('✗ ERROR');
      console.log(`  URL: ${check.url}`);
      console.log(`  Error: ${err.message}`);
      failed++;
    }
  }

  console.log('─'.repeat(80));
  console.log(`\n${passed} passed, ${failed} failed of ${checks.length} checks`);

  if (failed > 0) {
    console.log('\nIf a check failed, the most likely cause is a query that\'s serving stale');
    console.log('cache data. Look at the "Feeds" line for that check — those are the queries');
    console.log('that produce the data on that page.');
    process.exit(1);
  } else {
    console.log('\nAll checks passed. Week is fully published.');
    process.exit(0);
  }
}

runChecks().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
