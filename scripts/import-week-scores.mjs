#!/usr/bin/env node
/**
 * Weekly Score Import Pipeline
 *
 * Two-phase workflow run via Claude Code conversation:
 *
 *   Phase 1 — PULL:  Fetch scores from LeaguePals, resolve bowlers, save staging JSON
 *     node scripts/import-week-scores.mjs pull --cookie="connect.sid=s%3A..." --week=5 [--season=35]
 *
 *   Phase 2 — IMPORT: Read reviewed staging JSON, insert into DB
 *     node scripts/import-week-scores.mjs import --week=5 [--season=35] [--dry-run]
 *
 * Between phases, Claude shows formatted tables for human review.
 * Human adds turkey counts + corrections, Claude updates the staging file.
 */

import sql from 'mssql';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');
const STAGING_DIR = resolve(PROJECT_ROOT, 'docs/pending');

// ─── Load env ────────────────────────────────────────────────────────────────

const envContent = readFileSync(resolve(PROJECT_ROOT, '.env.local'), 'utf8');
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim();
}

const dbConfig = {
  server: process.env.AZURE_SQL_SERVER,
  database: process.env.AZURE_SQL_DATABASE,
  user: process.env.AZURE_SQL_USER,
  password: process.env.AZURE_SQL_PASSWORD,
  options: {
    encrypt: true,
    trustServerCertificate: false,
    connectTimeout: 120000,
    requestTimeout: 30000,
  },
};

// ─── LP Config (Season 35) ──────────────────────────────────────────────────

const LP_LEAGUE_ID = '696e613d3d649815687f7823';
const LP_BASE = 'https://www.leaguepals.com';

// LP team name → DB teamID (normalized LP names, lowercase for matching)
const LP_TEAM_MAP = {
  'alley oops': 1,
  'bowl durham': 4,
  'e bowla': 7,
  'e-bowla': 7,
  'fancy pants': 8,
  "grandma's teeth": 9,
  'gutterglory': 11,
  'guttermouths': 12,
  'guttersnipes': 13,
  'the guttersnipes': 13,
  'hot fun': 14,
  'hot shotz': 15,
  'living on a spare': 17,
  'lucky strikes': 18,
  'pin ups': 22,
  'pin-ups': 22,
  'smoke a bowl': 26,
  'smoke-a-bowl': 26,
  'sparadigm shift': 28,
  'stinky cheese': 31,
  'the boom kings': 33,
  'thoughts and spares': 38,
  'valley of the balls': 39,
  'wild llamas': 42,
};

// ─── Parse args ──────────────────────────────────────────────────────────────

const [,, command, ...rest] = process.argv;
const args = rest;
const getArg = (prefix) => args.find(a => a.startsWith(prefix))?.replace(prefix, '') ?? null;

const weekNum = parseInt(getArg('--week='), 10);
const seasonID = parseInt(getArg('--season=') ?? '35', 10);
const dryRun = args.includes('--dry-run');
const cookieVal = getArg('--cookie=');

if (!command || !['pull', 'import', 'show'].includes(command)) {
  console.error('Usage:');
  console.error('  node scripts/import-week-scores.mjs pull --cookie="connect.sid=..." --week=N [--season=N]');
  console.error('  node scripts/import-week-scores.mjs show --week=N [--season=N]');
  console.error('  node scripts/import-week-scores.mjs import --week=N [--season=N] [--dry-run]');
  process.exit(1);
}

if (!weekNum || isNaN(weekNum)) {
  console.error('ERROR: --week=N is required');
  process.exit(1);
}

const stagingFile = resolve(STAGING_DIR, `s${seasonID}-week-${weekNum}.json`);

// ─── Name matching ───────────────────────────────────────────────────────────

function normalizeName(name) {
  return name.toLowerCase().replace(/[^a-z]/g, '');
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[m][n];
}

function matchBowlerToDB(lpName, dbBowlers) {
  const target = normalizeName(lpName);

  // Exact normalized match
  let match = dbBowlers.find(b => normalizeName(b.bowlerName) === target);
  if (match) return match;

  // Last name + first initial
  const parts = lpName.trim().split(/\s+/);
  if (parts.length >= 2) {
    const firstName = parts[0].toLowerCase();
    const lastName = parts[parts.length - 1].toLowerCase();
    match = dbBowlers.find(b => {
      const bParts = b.bowlerName.split(/\s+/);
      const bFirst = bParts[0]?.toLowerCase() ?? '';
      const bLast = bParts[bParts.length - 1]?.toLowerCase() ?? '';
      return bLast === lastName && (bFirst === firstName || bFirst.startsWith(firstName[0]));
    });
    if (match) return match;

    // Last name only (single match)
    const lastNameMatches = dbBowlers.filter(b => {
      const bParts = b.bowlerName.split(/\s+/);
      return bParts[bParts.length - 1]?.toLowerCase() === lastName;
    });
    if (lastNameMatches.length === 1) return lastNameMatches[0];
  }

  // Fuzzy match (Levenshtein ≤ 2, unique best)
  const candidates = dbBowlers.map(b => ({ bowler: b, dist: levenshtein(target, normalizeName(b.bowlerName)) }));
  candidates.sort((a, b) => a.dist - b.dist);
  if (candidates[0] && candidates[0].dist <= 2 && candidates[0].dist < (candidates[1]?.dist ?? Infinity)) {
    return candidates[0].bowler;
  }

  return null;
}

// ─── PULL command ────────────────────────────────────────────────────────────

async function pullScores() {
  if (!cookieVal) {
    console.error('ERROR: --cookie="connect.sid=s%3A..." is required for pull');
    process.exit(1);
  }

  const headers = {
    'Accept': 'application/json',
    'Cookie': cookieVal,
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
  };

  console.log(`Pulling scores from LeaguePals for Season ${seasonID}, Week ${weekNum}...\n`);

  // 1. Get latest score info to find the right weekIdx
  const latestRes = await fetch(`${LP_BASE}/latestScore?id=${LP_LEAGUE_ID}`, { headers });
  if (!latestRes.ok) throw new Error(`latestScore failed: ${latestRes.status}`);
  const latestData = await latestRes.json();
  const latestWeekIdx = latestData.data?.weekIdx ?? 0;
  const latestDate = latestData.data?.date;
  console.log(`LP latest: weekIdx=${latestWeekIdx}, date=${latestDate}`);

  // weekIdx is 0-based in LP, our weeks are 1-based
  const targetWeekIdx = weekNum - 1;

  // 2. Get scores — use a wide date range to capture the target week
  const maxDate = new Date('2027-01-01').getTime();
  const minDate = new Date('2025-01-01').getTime();
  const scoresUrl = `${LP_BASE}/recentScores?leagueId=${LP_LEAGUE_ID}&maxDate=${maxDate}&minDate=${minDate}&weekIdx=${targetWeekIdx}`;
  const scoresRes = await fetch(scoresUrl, { headers });
  if (!scoresRes.ok) throw new Error(`recentScores failed: ${scoresRes.status}`);
  const scoresData = await scoresRes.json();
  const matches = scoresData.data;

  if (!matches || matches.length === 0) {
    console.error('No matches found for this week!');
    process.exit(1);
  }
  console.log(`Found ${matches.length} matches\n`);

  // 3. Get user mapping (LP userId → name)
  const teamsRes = await fetch(`${LP_BASE}/loadTeams?fullLoad=true&id=${LP_LEAGUE_ID}&withBowlers=true`, { headers });
  if (!teamsRes.ok) throw new Error(`loadTeams failed: ${teamsRes.status}`);
  const teamsData = await teamsRes.json();
  const lpUsers = {};
  const usersArr = teamsData.data?.users || [];
  for (const u of (Array.isArray(usersArr) ? usersArr : Object.values(usersArr))) {
    if (u._id) lpUsers[u._id] = u.name;
  }
  console.log(`Loaded ${Object.keys(lpUsers).length} LP users\n`);

  // 4. Get DB bowlers for matching
  const pool = await new sql.ConnectionPool(dbConfig).connect();
  const bowlersResult = await pool.request().query(`
    SELECT bowlerID, bowlerName, slug, gender FROM bowlers
  `);
  const dbBowlers = bowlersResult.recordset;

  // 5. Get incomingAvg for each bowler going into this week
  const avgResult = await pool.request().query(`
    SELECT bowlerID,
      (SELECT TOP 1 x.avg27 FROM (
        SELECT AVG(CAST(g.val AS FLOAT)) AS avg27
        FROM (
          SELECT TOP 27 x2.val
          FROM scores s2
          CROSS APPLY (VALUES (s2.game1),(s2.game2),(s2.game3)) AS x2(val)
          WHERE s2.bowlerID = b.bowlerID AND s2.isPenalty = 0 AND x2.val IS NOT NULL
            AND (s2.seasonID < ${seasonID} OR (s2.seasonID = ${seasonID} AND s2.week < ${weekNum}))
          ORDER BY s2.seasonID DESC, s2.week DESC
        ) g
      ) x) AS incomingAvg
    FROM bowlers b
    WHERE b.bowlerID IN (SELECT DISTINCT bowlerID FROM scores WHERE isPenalty = 0)
  `);
  const avgMap = new Map();
  for (const row of avgResult.recordset) {
    if (row.incomingAvg != null) {
      avgMap.set(row.bowlerID, Math.floor(row.incomingAvg));
    }
  }

  await pool.close();

  // 6. Build staging data
  const matchDate = matches[0]?.date ? matches[0].date.split('T')[0] : null;
  const staged = {
    seasonID,
    week: weekNum,
    matchDate,
    pulledAt: new Date().toISOString(),
    matches: [],
  };

  let warnings = [];

  for (const m of matches) {
    const homeTeamName = m.team1Ref.name;
    const awayTeamName = m.team2Ref.name;
    const homeTeamID = LP_TEAM_MAP[homeTeamName.toLowerCase()];
    const awayTeamID = LP_TEAM_MAP[awayTeamName.toLowerCase()];

    if (!homeTeamID) warnings.push(`Unknown home team: "${homeTeamName}"`);
    if (!awayTeamID) warnings.push(`Unknown away team: "${awayTeamName}"`);

    const matchEntry = {
      homeTeamName,
      awayTeamName,
      homeTeamID: homeTeamID ?? null,
      awayTeamID: awayTeamID ?? null,
      bowlers: [],
    };

    for (let ti = 0; ti < m.teams.length; ti++) {
      const team = m.teams[ti];
      const isHome = team._id === m.team1Ref._id;
      const teamID = isHome ? homeTeamID : awayTeamID;
      const teamName = isHome ? homeTeamName : awayTeamName;

      for (const p of team.players) {
        const lpName = p.bowler?.name || p.subName || 'Unknown';
        const isBlind = p.games?.some(g => g.isBlind) || false;
        const isVacant = p.isVacant || p.games?.some(g => g.isVacant) || false;
        const isSub = p.isSubstitute || false;
        const games = p.games?.map(g => g.totalPins) ?? [];

        // Blind = penalty in our system
        const isPenalty = isBlind || isVacant;

        // Try to match to DB bowler
        const dbMatch = isPenalty ? null : matchBowlerToDB(lpName, dbBowlers);

        const bowlerEntry = {
          lpName,
          side: isHome ? 'home' : 'away',
          teamID,
          teamName,
          bowlerID: dbMatch?.bowlerID ?? null,
          bowlerName: dbMatch?.bowlerName ?? (isPenalty ? null : lpName),
          gender: dbMatch?.gender ?? null,
          game1: isPenalty ? null : (games[0] ?? null),
          game2: isPenalty ? null : (games[1] ?? null),
          game3: isPenalty ? null : (games[2] ?? null),
          isPenalty,
          turkeys: 0,
          incomingAvg: dbMatch ? (avgMap.get(dbMatch.bowlerID) ?? null) : null,
          flags: [],
        };

        if (isPenalty) bowlerEntry.flags.push('PENALTY');
        if (isSub) bowlerEntry.flags.push('SUB');
        if (!dbMatch && !isPenalty) {
          bowlerEntry.flags.push('UNMATCHED');
          warnings.push(`Could not match "${lpName}" (${teamName}) to any DB bowler`);
        }
        if (dbMatch && dbMatch.bowlerName !== lpName) {
          bowlerEntry.flags.push(`MATCHED:${dbMatch.bowlerName}`);
        }
        if (!isPenalty && bowlerEntry.incomingAvg === null) {
          bowlerEntry.flags.push('NO_AVG');
        }

        matchEntry.bowlers.push(bowlerEntry);
      }
    }

    staged.matches.push(matchEntry);
  }

  // Save staging file
  if (!existsSync(STAGING_DIR)) {
    const { mkdirSync } = await import('fs');
    mkdirSync(STAGING_DIR, { recursive: true });
  }
  writeFileSync(stagingFile, JSON.stringify(staged, null, 2));
  console.log(`Staging file saved: ${stagingFile}`);

  if (warnings.length > 0) {
    console.log('\n⚠ WARNINGS:');
    for (const w of warnings) console.log(`  - ${w}`);
  }

  // Print summary
  console.log(`\n${staged.matches.length} matches staged for review.`);
  console.log('Run "show" command or review in Claude Code conversation.\n');
}

// ─── SHOW command ────────────────────────────────────────────────────────────

function showStaging() {
  if (!existsSync(stagingFile)) {
    console.error(`No staging file found: ${stagingFile}`);
    console.error('Run "pull" first.');
    process.exit(1);
  }

  const staged = JSON.parse(readFileSync(stagingFile, 'utf8'));
  console.log(`Season ${staged.seasonID}, Week ${staged.week} — ${staged.matchDate ?? 'no date'}`);
  console.log(`Pulled: ${staged.pulledAt}\n`);

  for (const match of staged.matches) {
    console.log(`${'═'.repeat(70)}`);
    console.log(`  ${match.homeTeamName} (${match.homeTeamID ?? '???'}) vs ${match.awayTeamName} (${match.awayTeamID ?? '???'})`);
    console.log(`${'═'.repeat(70)}`);
    console.log(`  ${'Bowler'.padEnd(22)} ${'G1'.padStart(5)} ${'G2'.padStart(5)} ${'G3'.padStart(5)} ${'Avg'.padStart(5)} ${'HCP'.padStart(5)} ${'Pen'.padStart(4)} ${'T'.padStart(3)}  Flags`);
    console.log(`  ${'─'.repeat(68)}`);

    const homeBowlers = match.bowlers.filter(b => b.side === 'home');
    const awayBowlers = match.bowlers.filter(b => b.side === 'away');

    for (const group of [homeBowlers, awayBowlers]) {
      for (const b of group) {
        const name = b.isPenalty ? '[Penalty]' : (b.bowlerName || b.lpName);
        const avg = b.incomingAvg != null ? String(b.incomingAvg) : '-';
        const hcp = b.incomingAvg != null ? String(Math.floor((225 - b.incomingAvg) * 0.95)) : (b.isPenalty ? '-' : 'NEW');
        const g1 = b.game1 != null ? String(b.game1) : '';
        const g2 = b.game2 != null ? String(b.game2) : '';
        const g3 = b.game3 != null ? String(b.game3) : '';
        const pen = b.isPenalty ? 'Y' : '';
        const t = b.isPenalty ? '' : String(b.turkeys);
        const flags = b.flags.length > 0 ? b.flags.join(', ') : '';

        console.log(`  ${name.padEnd(22)} ${g1.padStart(5)} ${g2.padStart(5)} ${g3.padStart(5)} ${avg.padStart(5)} ${hcp.padStart(5)} ${pen.padStart(4)} ${t.padStart(3)}  ${flags}`);
      }
      if (group === homeBowlers) {
        console.log(`  ${'·'.repeat(68)}`);
      }
    }
    console.log();
  }

  // Summary
  const allBowlers = staged.matches.flatMap(m => m.bowlers);
  const penalties = allBowlers.filter(b => b.isPenalty);
  const unmatched = allBowlers.filter(b => b.flags.includes('UNMATCHED'));
  const noAvg = allBowlers.filter(b => b.flags.includes('NO_AVG'));
  const totalTurkeys = allBowlers.reduce((s, b) => s + b.turkeys, 0);

  console.log(`${'─'.repeat(70)}`);
  console.log(`Total: ${allBowlers.length} bowlers, ${penalties.length} penalties, ${totalTurkeys} turkeys`);
  if (unmatched.length > 0) console.log(`⚠ ${unmatched.length} UNMATCHED bowlers — need manual resolution`);
  if (noAvg.length > 0) console.log(`ℹ ${noAvg.length} bowlers with no average (debuts or new)`);
}

// ─── IMPORT command ──────────────────────────────────────────────────────────

async function importScores() {
  if (!existsSync(stagingFile)) {
    console.error(`No staging file found: ${stagingFile}`);
    console.error('Run "pull" first, then review and correct the staging file.');
    process.exit(1);
  }

  const staged = JSON.parse(readFileSync(stagingFile, 'utf8'));
  const allBowlers = staged.matches.flatMap(m => m.bowlers);

  // Validation
  const unmatched = allBowlers.filter(b => !b.isPenalty && !b.bowlerID);
  if (unmatched.length > 0) {
    console.error('ERROR: Unmatched bowlers remain — resolve before importing:');
    for (const b of unmatched) console.error(`  - ${b.lpName} (${b.teamName})`);
    process.exit(1);
  }

  const noTeam = allBowlers.filter(b => !b.teamID);
  if (noTeam.length > 0) {
    console.error('ERROR: Bowlers with no teamID:');
    for (const b of noTeam) console.error(`  - ${b.bowlerName || b.lpName}`);
    process.exit(1);
  }

  console.log(dryRun ? '=== DRY RUN ===' : '=== IMPORTING SCORES ===');
  console.log(`Season ${staged.seasonID}, Week ${staged.week}\n`);

  const pool = await new sql.ConnectionPool(dbConfig).connect();

  // Check for existing scores this week
  const existing = await pool.request().query(
    `SELECT COUNT(*) AS cnt FROM scores WHERE seasonID = ${staged.seasonID} AND week = ${staged.week}`
  );
  if (existing.recordset[0].cnt > 0) {
    console.error(`ERROR: ${existing.recordset[0].cnt} scores already exist for S${staged.seasonID} Week ${staged.week}`);
    console.error('Delete existing scores first if re-importing.');
    await pool.close();
    process.exit(1);
  }

  let inserted = 0;

  for (const b of allBowlers) {
    // Penalty rows: NULL game scores, isPenalty = 1
    // The DB computed columns handle hcpGame = 199 and handSeries = 597
    const game1 = b.isPenalty ? null : b.game1;
    const game2 = b.isPenalty ? null : b.game2;
    const game3 = b.isPenalty ? null : b.game3;
    const turkeys = b.isPenalty ? 0 : (b.turkeys ?? 0);
    const incomingAvg = b.incomingAvg;

    // For penalties without a real bowlerID, use a placeholder
    // (penalties still need a bowlerID row — typically the absent bowler)
    const bowlerID = b.bowlerID;
    if (!bowlerID) {
      console.error(`  SKIP: No bowlerID for ${b.lpName} (${b.teamName})`);
      continue;
    }

    const query = `
      INSERT INTO scores (bowlerID, seasonID, teamID, week, game1, game2, game3, incomingAvg, turkeys, isPenalty)
      VALUES (@bowlerID, @seasonID, @teamID, @week, @game1, @game2, @game3, @incomingAvg, @turkeys, @isPenalty)
    `;

    if (dryRun) {
      const label = b.isPenalty ? '[Penalty]' : b.bowlerName;
      const scores = b.isPenalty ? 'NULL/NULL/NULL' : `${game1}/${game2}/${game3}`;
      console.log(`  INSERT: ${label} (${b.teamName}) — ${scores}, avg=${incomingAvg ?? 'NULL'}, t=${turkeys}`);
    } else {
      await pool.request()
        .input('bowlerID', sql.Int, bowlerID)
        .input('seasonID', sql.Int, staged.seasonID)
        .input('teamID', sql.Int, b.teamID)
        .input('week', sql.Int, staged.week)
        .input('game1', sql.Int, game1)
        .input('game2', sql.Int, game2)
        .input('game3', sql.Int, game3)
        .input('incomingAvg', sql.Decimal(10, 0), incomingAvg)
        .input('turkeys', sql.Int, turkeys)
        .input('isPenalty', sql.Bit, b.isPenalty ? 1 : 0)
        .query(query);
    }
    inserted++;
  }

  await pool.close();

  console.log(`\n${dryRun ? 'Would insert' : 'Inserted'}: ${inserted} rows`);

  if (!dryRun) {
    console.log('\n=== POST-IMPORT STEPS ===');
    console.log('Run these next:');
    console.log(`  node scripts/populate-match-results.mjs --season=${staged.seasonID}`);
    console.log(`  node scripts/populate-patches.mjs`);
    console.log(`  Then bust cache for S${staged.seasonID} queries and deploy.`);
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  switch (command) {
    case 'pull':
      await pullScores();
      break;
    case 'show':
      showStaging();
      break;
    case 'import':
      await importScores();
      break;
  }
}

main().catch(e => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
