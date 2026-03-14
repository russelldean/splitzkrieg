/**
 * Fix & Rebuild — single command after any data correction.
 *
 * Usage:
 *   node scripts/fix-rebuild.mjs --season=35
 *   node scripts/fix-rebuild.mjs --season=35 --dry-run
 *   node scripts/fix-rebuild.mjs --season=35 --skip-patches
 *   node scripts/fix-rebuild.mjs --season=35 --skip-match-results
 *
 * What it does (in order):
 *   1. Wipes & rebuilds matchResults for the season
 *   2. Rebuilds HCP-dependent patch types (botw, aboveAvg, hcpPlayoff)
 *   3. Clears disk cache for affected queries
 *   4. Prints summary of what was cleared
 *
 * After running: commit any changes, push to main, Vercel redeploys.
 */
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

// --- Parse args ---
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const skipPatches = args.includes('--skip-patches');
const skipMatchResults = args.includes('--skip-match-results');
const seasonArg = args.find(a => a.startsWith('--season='));

if (!seasonArg) {
  console.error('ERROR: --season=N is required');
  console.error('Usage: node scripts/fix-rebuild.mjs --season=35');
  process.exit(1);
}

const seasonID = parseInt(seasonArg.split('=')[1]);
if (isNaN(seasonID)) {
  console.error('ERROR: --season must be a number');
  process.exit(1);
}

// --- Cache paths ---
const CACHE_VERSION = (() => {
  try {
    const envContent = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8');
    for (const line of envContent.split('\n')) {
      const match = line.match(/^DB_CACHE_VERSION=(.*)$/);
      if (match) return match[1].trim();
    }
  } catch {}
  return '1';
})();

const VERSIONED_DIR = path.join(ROOT, '.next', 'cache', 'sql', `v${CACHE_VERSION}`);
const STABLE_DIR = path.join(ROOT, '.next', 'cache', 'sql', 'stable');

function run(cmd, label) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`STEP: ${label}`);
  console.log(`  cmd: ${cmd}`);
  console.log('='.repeat(60));
  if (dryRun) {
    console.log('  [DRY RUN — skipped]');
    return;
  }
  try {
    execSync(cmd, { cwd: ROOT, stdio: 'inherit' });
  } catch (err) {
    console.error(`\nFAILED: ${label}`);
    console.error(err.message);
    process.exit(1);
  }
}

// --- Step 1: Rebuild matchResults ---
if (!skipMatchResults) {
  run(
    `node scripts/populate-match-results.mjs --wipe --season=${seasonID}`,
    `Wipe & rebuild matchResults for season ${seasonID}`
  );
} else {
  console.log('\n[Skipping matchResults rebuild (--skip-match-results)]');
}

// --- Step 2: Rebuild HCP-dependent patches ---
// These are the patch types affected by incomingAvg changes:
//   botw      — highest handSeries that week (weekly)
//   aboveAvg  — all 3 games above incomingAvg (weekly)
//   hcpPlayoff — top 8 by handicap average (season-level)
const HCP_PATCH_TYPES = ['botw', 'aboveAvg', 'hcpPlayoff'];

if (!skipPatches) {
  for (const patchType of HCP_PATCH_TYPES) {
    run(
      `node scripts/populate-patches.mjs --wipe --patch=${patchType} --season=${seasonID}`,
      `Rebuild ${patchType} patches for season ${seasonID}`
    );
  }
} else {
  console.log('\n[Skipping patch rebuild (--skip-patches)]');
}

// --- Step 3: Clear affected cache files ---
console.log(`\n${'='.repeat(60)}`);
console.log('STEP: Clear disk cache');
console.log('='.repeat(60));

// Season-scoped queries to clear (match by seasonID in filename)
const SEASON_SCOPED_PATTERNS = [
  `getSeasonStandings-${seasonID}`,
  `getSeasonLeaderboard-${seasonID}`,
  `getSeasonFullStats-${seasonID}`,
  `getSeasonRecords-${seasonID}`,
  `getSeasonHeroStats-${seasonID}`,
  `getSeasonWeeklyScores-${seasonID}`,
  `getSeasonMatchResults-${seasonID}`,
  `getStandingsRaceData-${seasonID}`,
  `getSeasonWeekSummaries-${seasonID}`,
  `getTeamSeasonBowlers-`,  // any team+season combo
];

// Weekly-tier queries to clear (no seasonID in filename, affected by avg/score changes)
const WEEKLY_PATTERNS = [
  'getBowlerCareerSummary-',
  'getBowlerGameLog-',
  'getBowlerRollingAvgHistory-',
  'getBowlerSeasonStats-',
  'getBowlerOfTheWeek',
  'getBowlerPatches-',
  'getBowlerStarStats-',
  'getCurrentSeasonSnapshot',
  'getWeeklyHighlights',
  'getRecentMilestones',
  'getAllTimeLeaderboard',
  'getLeagueMilestones',
  'getTeamCurrentStanding-',
  'getTeamCurrentRoster-',
  'getTeamSeasonByseason-',
  'getTeamAllTimeRoster-',
  'getAllTeamsDirectory',
  'getTeamH2H-',
  'getGhostTeamH2H',
  'getPairwiseH2H',
  // Blog queries for this season
  'getTopPerformers',
  'getWeekMilestones',
  'getMatchResultsSummary',
  'getStandingsSnapshot',
  'getLeaderboardSnapshot',
];

let cleared = 0;
let skipped = 0;

function clearMatching(dir, patterns) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const matches = patterns.some(p => file.startsWith(p));
    if (matches) {
      const filePath = path.join(dir, file);
      if (dryRun) {
        console.log(`  [would delete] ${file}`);
      } else {
        fs.unlinkSync(filePath);
      }
      cleared++;
    } else {
      skipped++;
    }
  }
}

// Clear season-scoped from versioned dir
clearMatching(VERSIONED_DIR, SEASON_SCOPED_PATTERNS);

// Clear weekly-tier from versioned dir
clearMatching(VERSIONED_DIR, WEEKLY_PATTERNS);

// Never touch stable/ dir — those are slug lookups, nav lists, etc.

console.log(`\n  Cache files cleared: ${cleared}`);
console.log(`  Cache files preserved: ${skipped} (stable + other seasons)`);

// --- Summary ---
console.log(`\n${'='.repeat(60)}`);
console.log('DONE');
console.log('='.repeat(60));
console.log(`\nSeason: ${seasonID}`);
console.log(`Match results: ${skipMatchResults ? 'SKIPPED' : 'rebuilt'}`);
console.log(`Patches (${HCP_PATCH_TYPES.join(', ')}): ${skipPatches ? 'SKIPPED' : 'rebuilt'}`);
console.log(`Cache cleared: ${cleared} files`);
if (dryRun) {
  console.log('\n*** DRY RUN — no changes were made ***');
} else {
  console.log('\nNext steps:');
  console.log('  1. git add . && git commit');
  console.log('  2. git push (Vercel redeploys automatically)');
  console.log('  3. Or run `node scripts/warm-cache.mjs` to pre-fill cache before deploy');
  console.log('  4. Update content/updates.ts if this fix has user-visible changes');
}
