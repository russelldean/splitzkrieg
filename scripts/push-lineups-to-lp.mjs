#!/usr/bin/env node
/**
 * Push lineup submissions to LeaguePals from the command line.
 * Reads lineups from DB, matches to LP roster, pushes roster updates.
 *
 * Usage:
 *   node scripts/push-lineups-to-lp.mjs --cookie="connect.sid=s%3A..." [--week=5] [--season=35] [--team="Alley Oops"] [--dry-run]
 */

import sql from 'mssql';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');

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

// ─── LP Config ───────────────────────────────────────────────────────────────

const LP_LEAGUE_ID = '696e613d3d649815687f7823';
const LP_BASE = 'https://www.leaguepals.com';

const LP_TEAM_MAP = {
  'Alley Oops': '696e614e3d649815687f7935',
  'Bowl Durham': '696e61603d649815687f7a3a',
  'E-Bowla': '696e61483d649815687f78e1',
  'Fancy Pants': '696e614f3d649815687f794d',
  "Grandma's Teeth": '696e613d3d649815687f782b',
  'Gutterglory': '696e61583d649815687f79cb',
  'Guttermouths': '696e61493d649815687f78f9',
  'Guttersnipes': '696e613e3d649815687f7843',
  'HOT FUN': '696e61413d649815687f7867',
  'Hot Shotz': '696e61513d649815687f7968',
  'Living on a Spare': '696e615e3d649815687f7a1c',
  'Lucky Strikes': '696e61463d649815687f78bb',
  'Pin-Ups': '696e614b3d649815687f7917',
  'Smoke-A-Bowl': '696e61533d649815687f7989',
  'Smoke-a-Bowl': '696e61533d649815687f7989',
  'Sparadigm Shift': '696e61643d649815687f7a6d',
  'Stinky Cheese': '696e61553d649815687f79aa',
  'The Boom Kings': '696e615c3d649815687f7a07',
  'Thoughts and Spares': '696e61623d649815687f7a52',
  'Valley of the Balls': '696e61443d649815687f7885',
  'Wild Llamas': '696e615a3d649815687f79ec',
};

// ─── Parse args ──────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
function getArg(name) {
  const arg = args.find(a => a.startsWith(`--${name}=`));
  return arg ? arg.split('=').slice(1).join('=') : null;
}

const cookieRaw = getArg('cookie');
const dryRun = args.includes('--dry-run');
const teamFilter = getArg('team');

if (!cookieRaw) {
  console.error('Usage: node scripts/push-lineups-to-lp.mjs --cookie="connect.sid=s%3A..." [--week=5] [--season=35] [--team="Alley Oops"] [--dry-run]');
  process.exit(1);
}

const cookie = cookieRaw.startsWith('connect.sid=') ? cookieRaw : `connect.sid=${cookieRaw}`;

const headers = {
  Accept: 'application/json, text/plain, */*',
  'Content-Type': 'application/json;charset=UTF-8',
  Cookie: cookie,
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  Origin: LP_BASE,
  Referer: LP_BASE + '/all-teams-center',
};

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  if (dryRun) console.log('🔍 DRY RUN — no changes will be made\n');

  const pool = await sql.connect(dbConfig);

  // Auto-detect season and week if not provided
  let seasonID = getArg('season') ? parseInt(getArg('season'), 10) : null;
  let week = getArg('week') ? parseInt(getArg('week'), 10) : null;

  if (!seasonID) {
    const seasonResult = await pool.request().query(
      `SELECT TOP 1 seasonID FROM seasons ORDER BY year DESC, CASE period WHEN 'Fall' THEN 2 ELSE 1 END DESC`
    );
    seasonID = seasonResult.recordset[0]?.seasonID;
    if (!seasonID) { console.error('No season found'); process.exit(1); }
  }

  if (!week) {
    const lsResult = await pool.request().query(
      `SELECT settingValue FROM leagueSettings WHERE settingKey = 'publishedWeek'`
    );
    const publishedWeek = parseInt(lsResult.recordset[0]?.settingValue || '0', 10);
    week = publishedWeek + 1;
  }

  console.log(`Season: ${seasonID}, Week: ${week}`);
  if (teamFilter) console.log(`Team filter: ${teamFilter}`);
  console.log('');

  // Calculate 27-game rolling averages for all bowlers (cross-season)
  const avgResult = await pool.request()
    .input('seasonID', sql.Int, seasonID)
    .input('week', sql.Int, week)
    .query(`
      SELECT b.bowlerID, b.bowlerName,
        (SELECT TOP 1 x.avg27 FROM (
          SELECT AVG(CAST(g.val AS FLOAT)) AS avg27
          FROM (
            SELECT TOP 27 x2.val
            FROM scores s2
            CROSS APPLY (VALUES (s2.game1),(s2.game2),(s2.game3)) AS x2(val)
            WHERE s2.bowlerID = b.bowlerID AND s2.isPenalty = 0 AND x2.val IS NOT NULL
              AND (s2.seasonID < @seasonID OR (s2.seasonID = @seasonID AND s2.week < @week))
            ORDER BY s2.seasonID DESC, s2.week DESC
          ) g
        ) x) AS incomingAvg
      FROM bowlers b
      WHERE b.bowlerID IN (SELECT DISTINCT bowlerID FROM scores WHERE isPenalty = 0)
    `);
  const avgMap = new Map(); // bowlerName (normalized) -> floored avg
  for (const row of avgResult.recordset) {
    if (row.incomingAvg != null) {
      const norm = row.bowlerName.toLowerCase().replace(/[^a-z]/g, '');
      avgMap.set(norm, Math.floor(row.incomingAvg));
    }
  }
  console.log(`Loaded rolling averages for ${avgMap.size} bowlers\n`);

  // Get lineup submissions
  const subsResult = await pool.request()
    .input('seasonID', sql.Int, seasonID)
    .input('week', sql.Int, week)
    .query(`
      SELECT ls.id, ls.teamID, t.teamName
      FROM lineupSubmissions ls
      JOIN teams t ON ls.teamID = t.teamID
      WHERE ls.seasonID = @seasonID AND ls.week = @week
      ORDER BY t.teamName
    `);

  let submissions = subsResult.recordset;
  if (teamFilter) {
    submissions = submissions.filter(s => s.teamName.toLowerCase() === teamFilter.toLowerCase());
  }

  if (submissions.length === 0) {
    console.log('No lineup submissions found.');
    await pool.close();
    process.exit(0);
  }

  console.log(`Found ${submissions.length} lineup submission(s)\n`);

  let pushed = 0;
  let errors = 0;

  for (const sub of submissions) {
    const teamName = sub.teamName;
    const lpTeamID = LP_TEAM_MAP[teamName];

    if (!lpTeamID) {
      console.log(`❌ ${teamName}: No LP team ID mapped`);
      errors++;
      continue;
    }

    // Get lineup entries
    const entriesResult = await pool.request()
      .input('submissionID', sql.Int, sub.id)
      .query(`
        SELECT le.bowlerID, le.newBowlerName, b.bowlerName, le.position
        FROM lineupEntries le
        LEFT JOIN bowlers b ON le.bowlerID = b.bowlerID
        WHERE le.submissionID = @submissionID
        ORDER BY le.position
      `);

    const entries = entriesResult.recordset.map(e => {
      const name = e.bowlerID ? (e.bowlerName || 'TBD') : (e.newBowlerName || 'TBD');
      const norm = name.toLowerCase().replace(/[^a-z]/g, '');
      return { name, avg: avgMap.get(norm) ?? null };
    });

    console.log(`${teamName}: ${entries.map(e => e.name).join(', ')}`);

    // Load LP roster
    try {
      const loadRes = await fetch(
        `${LP_BASE}/api/loadIndividualTeam?id=${lpTeamID}&noPre=false`,
        { headers },
      );

      if (!loadRes.ok) {
        console.log(`  ❌ Failed to load LP roster: ${loadRes.status}`);
        errors++;
        continue;
      }

      const contentType = loadRes.headers.get('content-type') || '';
      if (!contentType.includes('json')) {
        console.log(`  ❌ LP returned HTML — cookie is expired or invalid`);
        errors++;
        break;
      }

      const teamData = await loadRes.json();
      const rosterData = teamData.data || teamData;
      const roster = Array.isArray(rosterData)
        ? rosterData
        : Object.values(rosterData).filter(v => v && typeof v === 'object' && v._id);

      if (!roster.length) {
        console.log(`  ❌ No roster found in LP`);
        errors++;
        continue;
      }

      // Match entries to LP roster, auto-adding missing bowlers
      let currentRoster = [...roster];
      let needsReload = false;

      for (const entry of entries) {
        const target = entry.name.toLowerCase().replace(/[^a-z]/g, '');
        const eParts = entry.name.trim().split(/\s+/);
        const eLast = eParts[eParts.length - 1].toLowerCase();
        const eFirst = eParts[0].toLowerCase();

        let lpBowler = currentRoster.find(b => {
          const name = String(b.name || '');
          return name.toLowerCase().replace(/[^a-z]/g, '') === target;
        });
        if (!lpBowler) {
          lpBowler = currentRoster.find(b => {
            return (b.firstName || '').toLowerCase() === eFirst && (b.lastName || '').toLowerCase() === eLast;
          });
        }
        if (!lpBowler) {
          const lastMatches = currentRoster.filter(b => (b.lastName || '').toLowerCase() === eLast);
          if (lastMatches.length === 1) lpBowler = lastMatches[0];
        }

        if (!lpBowler) {
          console.log(`  ⚠️  "${entry.name}" not on LP roster — searching LP...`);

          // Search LP for the bowler - try full name first, then first+last only
          const nameParts = entry.name.trim().split(/\s+/);
          const searchQueries = [entry.name];
          if (nameParts.length > 2) {
            // Try "FirstName LastName" without middle names
            searchQueries.push(`${nameParts[0]} ${nameParts[nameParts.length - 1]}`);
          }

          let found = null;
          for (const q of searchQueries) {
            const searchRes = await fetch(`${LP_BASE}/searchUsers`, {
              method: 'POST',
              headers,
              body: JSON.stringify({ q, exact: true, origin: 'AllTeamsCenter' }),
            });

            if (!searchRes.ok) {
              console.log(`  ❌ Search failed for "${q}": ${searchRes.status}`);
              continue;
            }

            const searchData = await searchRes.json();
            const users = searchData.data || searchData;

            if (Array.isArray(users) && users.length > 0) {
              // Try exact match on normalized name
              const lastName = nameParts[nameParts.length - 1].toLowerCase();
              found = users.find(u => {
                const uLast = (u.lastName || '').toLowerCase();
                const uFirst = (u.firstName || '').toLowerCase();
                return uLast === lastName && nameParts[0].toLowerCase().startsWith(uFirst[0] || '');
              });
              if (!found) {
                found = users.find(u => {
                  const uName = ((u.firstName || '') + (u.lastName || '')).toLowerCase().replace(/[^a-z]/g, '');
                  return uName === target;
                });
              }
              if (!found && users.length === 1) found = users[0];
              if (found) {
                if (q !== entry.name) console.log(`  ℹ️  Found "${entry.name}" as "${found.firstName} ${found.lastName}" on LP`);
                break;
              }
            }
          }

          if (!found) {
            console.log(`  ❌ "${entry.name}" not found on LeaguePals at all`);
            continue;
          }

          const firstName = found.firstName || entry.name.split(/\s+/)[0];
          const lastName = found.lastName || entry.name.split(/\s+/).slice(1).join(' ');

          if (dryRun) {
            console.log(`  🔍 Would add "${firstName} ${lastName}" (${found.email}) to ${teamName}`);
            needsReload = true;
            continue;
          }

          // Add bowler to team
          const addPayload = {
            type: 'invites',
            bowlers: [found.email],
            id: lpTeamID,
            fullBowlers: [{
              email: found.email,
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

          const addRes = await fetch(`${LP_BASE}/updateTeam`, {
            method: 'POST',
            headers,
            body: JSON.stringify(addPayload),
          });

          if (!addRes.ok) {
            const text = await addRes.text();
            console.log(`  ❌ Failed to add "${entry.name}": ${text}`);
            continue;
          }

          console.log(`  ➕ Added "${firstName} ${lastName}" to ${teamName}`);
          needsReload = true;
        }
      }

      // Reload roster if we added anyone
      if (needsReload && !dryRun) {
        const reloadRes = await fetch(
          `${LP_BASE}/api/loadIndividualTeam?id=${lpTeamID}&noPre=false`,
          { headers },
        );
        if (reloadRes.ok) {
          const reloadData = await reloadRes.json();
          const reloadRoster = reloadData.data || reloadData;
          currentRoster = Array.isArray(reloadRoster)
            ? reloadRoster
            : Object.values(reloadRoster).filter(v => v && typeof v === 'object' && v._id);
        }
      }

      // Build final roster: lineup bowlers on top, remaining roster members below
      const lineupTargets = entries.map(e => e.name.toLowerCase().replace(/[^a-z]/g, ''));
      const topBowlers = [];
      const restBowlers = [];
      let matchFailed = false;

      // First pass: find lineup bowlers in order
      for (const entry of entries) {
        const target = entry.name.toLowerCase().replace(/[^a-z]/g, '');
        const nameParts = entry.name.trim().split(/\s+/);
        const lastName = nameParts[nameParts.length - 1].toLowerCase();
        const firstName = nameParts[0].toLowerCase();

        let lpBowler = currentRoster.find(b => {
          const name = String(b.name || '');
          return name.toLowerCase().replace(/[^a-z]/g, '') === target;
        });
        // Fallback: match on first+last name (skip middle names)
        if (!lpBowler) {
          lpBowler = currentRoster.find(b => {
            const bFirst = (b.firstName || '').toLowerCase();
            const bLast = (b.lastName || '').toLowerCase();
            return bLast === lastName && bFirst === firstName;
          });
        }
        // Fallback: last name only if unique
        if (!lpBowler) {
          const lastNameMatches = currentRoster.filter(b => (b.lastName || '').toLowerCase() === lastName);
          if (lastNameMatches.length === 1) lpBowler = lastNameMatches[0];
        }

        if (!lpBowler) {
          console.log(`  ❌ Still can't find "${entry.name}" after adds`);
          matchFailed = true;
          break;
        }

        topBowlers.push(lpBowler);
      }

      if (matchFailed) { errors++; continue; }

      // Second pass: keep all other roster members below the lineup
      const topIds = new Set(topBowlers.map(b => b._id));
      for (const b of currentRoster) {
        if (!topIds.has(b._id)) {
          restBowlers.push(b);
        }
      }

      // Inject our rolling averages into LP bowler objects
      // Match by lineup entry name (from our DB) since LP name may differ
      for (let bi = 0; bi < topBowlers.length; bi++) {
        const b = topBowlers[bi];
        const entry = entries[bi];
        const entryNorm = entry ? entry.name.toLowerCase().replace(/[^a-z]/g, '') : '';
        const avg = entry ? (avgMap.get(entryNorm) ?? null) : null;
        if (avg != null) {
          // Update top-level average fields
          b.average = avg;
          b.enteringAvg = avg;
          b.realAvg = avg;
          // Update the league-specific average entry
          if (Array.isArray(b.averages)) {
            const leagueEntry = b.averages.find(a => a.league === LP_LEAGUE_ID);
            if (leagueEntry) leagueEntry.average = avg;
          }
        }
      }

      const fullRoster = [...topBowlers, ...restBowlers];

      if (dryRun) {
        console.log(`  ✅ Would push roster (${fullRoster.length} bowlers):`);
        fullRoster.forEach((b, i) => {
          const avgStr = i < topBowlers.length ? ` avg=${b.average ?? '?'}` : '';
          console.log(`     ${i + 1}. ${b.name}${i < topBowlers.length ? ' (lineup)' : ''}${avgStr}`);
        });
        pushed++;
        continue;
      }

      // Push full roster with lineup on top
      const payload = {
        type: 'roster_avg',
        bowlers: fullRoster.map(b => String(b.email || '')),
        roster: fullRoster,
        league: LP_LEAGUE_ID,
        id: lpTeamID,
        origin: 'AllTeamsCenter-updateRoster',
      };

      const updateRes = await fetch(`${LP_BASE}/updateTeam`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (!updateRes.ok) {
        const text = await updateRes.text();
        console.log(`  ❌ Push failed: ${text}`);
        errors++;
        continue;
      }

      console.log(`  ✅ Pushed successfully`);
      pushed++;

    } catch (err) {
      console.log(`  ❌ Error: ${err.message}`);
      errors++;
    }
  }

  console.log(`\nDone: ${pushed} pushed, ${errors} errors`);
  await pool.close();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
