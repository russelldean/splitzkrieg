#!/usr/bin/env node
/**
 * Updates LeaguePals team rosters and averages from the WeeklyMaster CSV.
 *
 * Usage:
 *   node scripts/update-leaguepals.mjs --cookie="connect.sid=s%3A..." [--dry-run] [--team="Grandma's Teeth"]
 *
 * The cookie value is your connect.sid from a logged-in LeaguePals session.
 * Grab it from Chrome DevTools → Application → Cookies → connect.sid
 *
 * --dry-run   Show what would be sent without making changes
 * --team=X    Only update a specific team (for testing)
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');

// ─── Config ──────────────────────────────────────────────────────────────────

const LEAGUE_ID = '696e613d3d649815687f7823'; // Season 35

// Team name mapping: CSV name → LP team ID
const TEAM_MAP = {
  "Alley Oops":          "696e614e3d649815687f7935",
  "Bowl Durham":         "696e61603d649815687f7a3a",
  "E-Bowla":             "696e61483d649815687f78e1",
  "Fancy Pants":         "696e614f3d649815687f794d",
  "Grandma's Teeth":     "696e613d3d649815687f782b",
  "Gutterglory":         "696e61583d649815687f79cb",
  "Guttermouths":        "696e61493d649815687f78f9",
  "Guttersnipes":        "696e613e3d649815687f7843",
  "HOT FUN":             "696e61413d649815687f7867",
  "Hot Shotz":           "696e61513d649815687f7968",
  "Living on a Spare":   "696e615e3d649815687f7a1c",
  "Lucky Strikes":       "696e61463d649815687f78bb",
  "Pin-Ups":             "696e614b3d649815687f7917",
  "Smoke-A-Bowl":        "696e61533d649815687f7989",
  "Sparadigm Shift":     "696e61643d649815687f7a6d",
  "Stinky Cheese":       "696e61553d649815687f79aa",
  "The Boom Kings":      "696e615c3d649815687f7a07",
  "Thoughts and Spares": "696e61623d649815687f7a52",
  "Valley of the Balls": "696e61443d649815687f7885",
  "Wild Llamas":         "696e615a3d649815687f79ec",
};

// ─── Parse args ──────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const cookieArg = args.find(a => a.startsWith('--cookie='));
const teamFilter = args.find(a => a.startsWith('--team='));
const csvArg = args.find(a => a.startsWith('--csv='));

if (!cookieArg) {
  console.error('ERROR: --cookie="connect.sid=s%3A..." is required');
  console.error('Grab it from Chrome DevTools → Application → Cookies → connect.sid');
  process.exit(1);
}

const cookie = cookieArg.replace('--cookie=', '');
const filterTeam = teamFilter ? teamFilter.replace('--team=', '') : null;
const csvPath = csvArg
  ? resolve(csvArg.replace('--csv=', ''))
  : resolve(PROJECT_ROOT, 'docs/Scoresheets - WeeklyMaster.csv');

// ─── Parse CSV ───────────────────────────────────────────────────────────────

function parseWeeklyMaster(filePath) {
  const raw = readFileSync(filePath, 'utf-8');
  const lines = raw.split('\n').filter(l => l.trim());

  // Teams keyed by name, each with ordered array of { name, average, handicap }
  const teams = {};

  for (const line of lines) {
    const cols = line.split(',').map(c => c.trim());
    // Skip header rows (first two lines)
    if (!cols[1] || cols[1] === 'Raw Scoresheet Data' || !cols[2]) continue;
    // Skip if average isn't a number
    const avg = parseInt(cols[3], 10);
    if (isNaN(avg)) continue;

    const teamName = cols[1];
    const bowlerName = cols[2];
    const handicap = parseInt(cols[4], 10) || 0;

    if (!teams[teamName]) teams[teamName] = [];
    teams[teamName].push({ name: bowlerName, average: avg, handicap });
  }

  return teams;
}

// ─── LP API helpers ──────────────────────────────────────────────────────────

const BASE = 'https://www.leaguepals.com';
const HEADERS = {
  'Accept': 'application/json, text/plain, */*',
  'Content-Type': 'application/json;charset=UTF-8',
  'Cookie': cookie,
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  'Origin': BASE,
  'Referer': BASE + '/all-teams-center',
};

async function loadTeam(teamId) {
  const url = `${BASE}/api/loadIndividualTeam?id=${teamId}&noPre=false`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`loadTeam ${teamId}: ${res.status} ${res.statusText}`);
  return res.json();
}

async function updateTeam(payload) {
  const res = await fetch(`${BASE}/updateTeam`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`updateTeam: ${res.status} ${res.statusText} - ${text}`);
  }
  return res.json();
}

async function searchUser(name) {
  const res = await fetch(`${BASE}/searchUsers`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ q: name, exact: true, origin: 'AllTeamsCenter' }),
  });
  if (!res.ok) throw new Error(`searchUser "${name}": ${res.status}`);
  return res.json();
}

async function addBowlerToTeam(teamId, bowlerName) {
  // Search LP for the bowler
  const searchResult = await searchUser(bowlerName);
  const users = searchResult.data || searchResult;

  // Find the best match from search results
  const target = normalizeName(bowlerName);
  let found = null;

  if (Array.isArray(users)) {
    found = users.find(u => normalizeName((u.firstName || '') + (u.lastName || '')) === target);
    if (!found && users.length === 1) found = users[0];
  }

  if (!found) {
    throw new Error(`Search returned no match for "${bowlerName}". Results: ${JSON.stringify(users).slice(0, 200)}`);
  }

  const email = found.email;
  const firstName = found.firstName || bowlerName.split(/\s+/)[0];
  const lastName = found.lastName || bowlerName.split(/\s+/).slice(1).join(' ');

  // Send invite to add them to the team
  const payload = {
    type: 'invites',
    bowlers: [email],
    id: teamId,
    fullBowlers: [{
      email,
      canEdit: true,
      enteredName: true,
      isFemale: false,
      isJunior: false,
      dontIdentify: false,
      average: 0,
      totalPointsCarryOn: 0,
      gamesCarryOn: 0,
      individualPoints: 0,
      lastName,
      firstName,
      name: `${firstName} ${lastName}`,
    }],
    origin: 'AllTeamsCenter-sendInvites',
  };

  await updateTeam(payload);
  return { email, firstName, lastName, name: `${firstName} ${lastName}` };
}

// ─── Name matching ───────────────────────────────────────────────────────────

function normalizeName(name) {
  return name.toLowerCase().replace(/[^a-z]/g, '');
}

// Levenshtein distance for fuzzy matching
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[m][n];
}

function findBowlerInRoster(roster, csvName) {
  const target = normalizeName(csvName);
  // Try exact normalized match first
  let match = roster.find(b => normalizeName(b.name) === target);
  if (match) return match;

  // Try last name + first initial
  const parts = csvName.trim().split(/\s+/);
  if (parts.length >= 2) {
    const firstName = parts[0].toLowerCase();
    const lastName = parts[parts.length - 1].toLowerCase();
    match = roster.find(b => {
      const bFirst = (b.firstName || '').toLowerCase();
      const bLast = (b.lastName || '').toLowerCase();
      return bLast === lastName && (bFirst === firstName || bFirst.startsWith(firstName[0]));
    });
    if (match) return match;

    // Fuzzy: last name match only (for nicknames, abbreviations)
    const lastNameMatches = roster.filter(b => (b.lastName || '').toLowerCase() === lastName);
    if (lastNameMatches.length === 1) return lastNameMatches[0];
  }

  // Single-name match: if CSV has just a last name (e.g. "Farrell"), match on last name
  // but only if there's exactly one roster bowler with that last name as their last name
  if (parts.length === 1) {
    const singleName = parts[0].toLowerCase();
    const lastNameHits = roster.filter(b => (b.lastName || '').toLowerCase() === singleName);
    if (lastNameHits.length === 1) return lastNameHits[0];
    // Also try matching where first and last name are the same (e.g. "Farrell Farrell")
    const doubleHit = roster.find(b =>
      (b.firstName || '').toLowerCase() === singleName && (b.lastName || '').toLowerCase() === singleName
    );
    if (doubleHit) return doubleHit;
  }

  // Fuzzy match: allow small spelling differences (e.g. Bennet vs Bennett)
  const candidates = roster.map(b => ({ bowler: b, dist: levenshtein(target, normalizeName(b.name)) }));
  candidates.sort((a, b) => a.dist - b.dist);
  if (candidates[0] && candidates[0].dist <= 2 && candidates[0].dist < (candidates[1]?.dist ?? Infinity)) {
    return candidates[0].bowler;
  }

  return null;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(dryRun ? '🔍 DRY RUN — no changes will be made\n' : '');

  const csvTeams = parseWeeklyMaster(csvPath);
  const teamNames = Object.keys(csvTeams);
  console.log(`Parsed ${teamNames.length} teams from CSV\n`);

  let updated = 0;
  let errors = 0;

  for (const csvTeamName of teamNames) {
    if (filterTeam && csvTeamName !== filterTeam) continue;

    const teamId = TEAM_MAP[csvTeamName];
    if (!teamId) {
      console.error(`❌ No LP team ID mapped for "${csvTeamName}"`);
      errors++;
      continue;
    }

    const csvBowlers = csvTeams[csvTeamName];
    console.log(`── ${csvTeamName} (${csvBowlers.length} bowlers) ──`);

    // Load current team state from LP
    let teamData;
    try {
      teamData = await loadTeam(teamId);
    } catch (e) {
      console.error(`  ❌ Failed to load team: ${e.message}`);
      errors++;
      continue;
    }

    // LP returns { data: { 0: bowler, 1: bowler, ... } } — an object with numeric keys
    const rosterData = teamData.data || teamData;
    const roster = Array.isArray(rosterData)
      ? rosterData
      : Object.values(rosterData).filter(v => v && typeof v === 'object' && v._id);
    if (!roster.length) {
      console.error(`  ❌ No roster found in LP response`);
      errors++;
      continue;
    }

    // Match CSV bowlers to LP roster and build new order
    const newBowlerEmails = [];
    const newRoster = [];
    let matchFailed = false;

    for (const csvBowler of csvBowlers) {
      let lpBowler = findBowlerInRoster(roster, csvBowler.name);

      // Bowler not on this LP team — search and add them as a sub
      if (!lpBowler) {
        console.log(`  ⚠ "${csvBowler.name}" not on LP roster — searching and adding...`);
        if (dryRun) {
          console.log(`    → Would search & add (dry run)`);
          matchFailed = true;
          break;
        }
        try {
          const added = await addBowlerToTeam(teamId, csvBowler.name);
          console.log(`    → Added ${added.name} (${added.email})`);
          // Reload team to get fresh roster with the new bowler
          await new Promise(r => setTimeout(r, 1000));
          teamData = await loadTeam(teamId);
          const freshData = teamData.data || teamData;
          roster.length = 0;
          roster.push(...(Array.isArray(freshData)
            ? freshData
            : Object.values(freshData).filter(v => v && typeof v === 'object' && v._id)));
          lpBowler = findBowlerInRoster(roster, csvBowler.name);
          if (!lpBowler) {
            console.error(`    ❌ Added but still can't find in roster`);
            matchFailed = true;
            break;
          }
        } catch (e) {
          console.error(`    ❌ Failed to add: ${e.message}`);
          matchFailed = true;
          break;
        }
      }

      // Update average at top level
      const oldAvg = lpBowler.average;
      lpBowler.average = csvBowler.average;
      lpBowler.realAvg = csvBowler.average;
      lpBowler.enteringAvg = csvBowler.average;

      // Update the averages entry for this league/team
      if (lpBowler.averages) {
        const leagueAvg = lpBowler.averages.find(
          a => a.league === LEAGUE_ID && a.team === teamId
        );
        if (leagueAvg) {
          leagueAvg.average = csvBowler.average;
        }
      }

      newBowlerEmails.push(lpBowler.email);
      newRoster.push(lpBowler);

      const avgChange = oldAvg !== csvBowler.average ? ` (avg ${oldAvg} → ${csvBowler.average})` : '';
      console.log(`  ✓ ${csvBowler.name} → ${lpBowler.name}${avgChange}`);
    }

    if (matchFailed) {
      errors++;
      continue;
    }

    // Build the updateTeam payload
    const payload = {
      type: 'roster_avg',
      bowlers: newBowlerEmails,
      roster: newRoster,
      league: LEAGUE_ID,
      id: teamId,
      origin: 'AllTeamsCenter-updateRoster',
    };

    if (dryRun) {
      console.log(`  → Would update (dry run)\n`);
    } else {
      try {
        await updateTeam(payload);
        console.log(`  → ✅ Updated!\n`);
        updated++;
        // Small delay to be polite to their API
        await new Promise(r => setTimeout(r, 500));
      } catch (e) {
        console.error(`  → ❌ Update failed: ${e.message}\n`);
        errors++;
      }
    }
  }

  console.log(`\nDone! Updated: ${updated}, Errors: ${errors}`);
  if (dryRun) console.log('(Dry run — nothing was actually changed)');
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
