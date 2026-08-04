#!/usr/bin/env node
/**
 * Read-only snapshot of a LeaguePals event: teams, slots, rosters, membership rows,
 * and the archived/removed team list. Writes raw JSON to the scratchpad for diffing.
 *
 * Usage: node scripts/tmp-lp-inspect.mjs --league=<24-hex> --cookie-file=<path>
 */
import { readFileSync, writeFileSync } from 'fs';

const LP_BASE = 'https://www.leaguepals.com';
const arg = (k, d) => {
  const hit = process.argv.find(a => a.startsWith(`--${k}=`));
  return hit ? hit.split('=').slice(1).join('=') : d;
};
const LEAGUE = arg('league');
const COOKIE_FILE = arg('cookie-file');
const OUT_DIR = arg('out', '/private/tmp/claude-501/-Users-russdean-Projects-splitzkrieg/90b6425d-c326-4c07-8448-afa39c23a57b/scratchpad');
if (!LEAGUE || !COOKIE_FILE) { console.error('need --league= and --cookie-file='); process.exit(1); }

const raw = readFileSync(COOKIE_FILE, 'utf8').trim();
const cookie = raw.startsWith('connect.sid=') ? raw : `connect.sid=${raw}`;
const headers = {
  Accept: 'application/json, text/plain, */*',
  'Content-Type': 'application/json',
  Cookie: cookie,
  'User-Agent': 'Mozilla/5.0',
  Origin: LP_BASE,
  Referer: LP_BASE + '/all-teams-center',
};

async function get(path) {
  const res = await fetch(`${LP_BASE}${path}`, { headers });
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('json')) {
    throw new Error(`${path} -> ${res.status} ${ct} (cookie expired or wrong path prefix?)`);
  }
  return res.json();
}

const main = async () => {
  const lt = await get(`/loadTeams?fullLoad=true&id=${LEAGUE}&withBowlers=true`);
  const fli = await get(`/fullLeagueInfo?id=${LEAGUE}`);
  let removed = null;
  try { removed = await get(`/getRemovedTeams?id=${LEAGUE}`); } catch (e) { removed = { error: String(e.message) }; }

  const teams = (lt.data && lt.data.teams) || [];
  const users = (lt.data && lt.data.users) || {};
  const fd = fli.data || fli;
  const members = fd.members || [];

  // Rich roster per team.
  const rosters = {};
  for (const t of teams) {
    const det = await get(`/api/loadIndividualTeam?id=${t._id}&noPre=false`);
    rosters[t.name] = det.data || det;
  }

  writeFileSync(`${OUT_DIR}/lp-B-loadTeams.json`, JSON.stringify(lt, null, 2));
  writeFileSync(`${OUT_DIR}/lp-B-fullLeagueInfo.json`, JSON.stringify(fli, null, 2));
  writeFileSync(`${OUT_DIR}/lp-B-removed.json`, JSON.stringify(removed, null, 2));
  writeFileSync(`${OUT_DIR}/lp-B-rosters.json`, JSON.stringify(rosters, null, 2));

  console.log(`=== LIVE TEAMS (${teams.length}) ===`);
  for (const t of teams) {
    const det = rosters[t.name];
    const arr = (det && (det.bowlers || det.roster || det.members)) || [];
    console.log(`  slot ${String(t.teamNumber ?? t.number ?? '?').padStart(2)}  ${t.name.padEnd(24)} seats=${Array.isArray(arr) ? arr.length : '?'}  _id=${t._id}`);
  }
  console.log(`\n=== MEMBERSHIP ROWS: ${members.length} ===`);
  const seats = teams.reduce((n, t) => {
    const det = rosters[t.name];
    const arr = (det && (det.bowlers || det.roster || det.members)) || [];
    return n + (Array.isArray(arr) ? arr.length : 0);
  }, 0);
  console.log(`=== TOTAL ROSTER SEATS: ${seats} ===`);
  console.log(`(seating check: members should equal seats)`);

  console.log(`\n=== REMOVED / ARCHIVED TEAMS ===`);
  const rl = (removed && (removed.data || removed)) || [];
  if (Array.isArray(rl)) {
    for (const t of rl) console.log(`  slot ${String(t.teamNumber ?? t.number ?? '?').padStart(2)}  ${t.name}  _id=${t._id}`);
  } else {
    console.log('  ' + JSON.stringify(rl).slice(0, 400));
  }
  console.log(`\nusers in league: ${Object.keys(users).length}`);
  console.log(`raw JSON written to ${OUT_DIR}/lp-B-*.json`);
};

main().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
