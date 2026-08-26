#!/usr/bin/env node
/**
 * One-command LeaguePals prep for a split-phase game night.
 *
 * Replaces the per-night hand-edited scripts (gen-lp-event-csv, gen-lp-event-b-csv,
 * verify-lp-event, check-lp-lanes). Nothing about a given night is hardcoded: the
 * field, the week, the lineups and the lane pairings all come from our `schedule`
 * table keyed on --date.
 *
 * Phases (run in this order):
 *   plan     (default)  read-only. Diffs our field vs the event, prints the rename
 *                       plan, builds the Team Import CSV, flags every problem.
 *   renames  --apply-renames   executes the slot renames the plan printed.
 *   verify   --verify    after you upload the CSV: seats, membership rows,
 *                        entering averages, lineup order.
 *   lanes    --lanes     diffs the event's lane schedule against our matchups.
 *
 * Usage:
 *   node scripts/lp-prep-night.mjs --date=2026-08-10 --event=A --cookie-file=/path/cookie.txt
 *   node scripts/lp-prep-night.mjs --date=2026-08-10 --event=A --cookie-file=... --apply-renames
 *   node scripts/lp-prep-night.mjs --date=2026-08-10 --event=A --cookie-file=... --verify
 *   node scripts/lp-prep-night.mjs --date=2026-08-10 --event=A --cookie-file=... --lanes
 *
 * Why the CSV and not the API: `roster_avg` never creates league membership rows,
 * so bowlers added that way are invisible to LP's scoring engine. Team Import CSV
 * with Update ON is the only non-emailing path that seats a bowler. Team ID is
 * always left BLANK so the importer matches on Team Name (archived teams squat on
 * IDs and would reject the row).
 */
import sql from 'mssql';
import { readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';

const LP = 'https://www.leaguepals.com';

const EVENTS = {
  A: '69ff6a4b6f327c1e53b16b61',
  B: '69ff6c824e0fec0b32dcbef8',
  C: '69ff6fa7d824a6df6ec83597',
};

const arg = (k, d) => {
  const hit = process.argv.find(a => a.startsWith(`--${k}=`));
  return hit ? hit.split('=').slice(1).join('=') : d;
};
const flag = k => process.argv.includes(`--${k}`);

const DATE = arg('date');
const EVENT = (arg('event', 'A') || 'A').toUpperCase();
const COOKIE_FILE = arg('cookie-file');
const OUT = arg('out', `${homedir()}/Downloads`);
const LEAGUE = EVENTS[EVENT] || EVENT;

if (!DATE || !/^\d{4}-\d{2}-\d{2}$/.test(DATE)) {
  console.error('need --date=YYYY-MM-DD');
  process.exit(1);
}
if (!COOKIE_FILE) {
  console.error('need --cookie-file=<path to a file holding connect.sid>');
  process.exit(1);
}

// ---------------------------------------------------------------- name matching

// LP spelling -> our DB bowlerName. Applied before any fuzzy matching.
const BOWLER_ALIAS = {
  'anthony bennett': 'Anthony Bennet', 'jessa witzel': 'Jessa Carpenter',
  'emma richardson': 'Emma Jane Richardson', 'nick hicks': 'Daz Hicks',
  'clark b': 'Clark Brunner', 'colin henrahen': 'Colin Henrahan',
  'ian mccarthy': 'Ian McCarthy', 'annie segrest': 'Annie Seagrest',
  'glenn booth': 'Glenn Boothe', 'nate boden': 'Nathan Boden',
  'geoff berry': 'Geoffrey Berry', 'val faulkner': 'Valerie Faulkner',
  'ben price': 'Ben Rice',
  // Our DB stores these two short, matching the scoresheets. Farrell has no
  // surname on purpose -- Kelly Farrell (373) is a DIFFERENT person.
  'jennifer peters': 'J Peters', 'farrell farrell': 'Farrell',
};
// Our team name -> the C league's spelling, where it is not a punctuation variant.
const TEAM_ALIAS = { 'hotfun': 'bowlonomics' };

const norm = s => String(s).toLowerCase().replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim();
const bkey = s => norm(BOWLER_ALIAS[norm(s)] || s);
// Teams: drop punctuation AND spaces AND a leading "the" so "Smoke-a-Bowl" ==
// "Smoke a Bowl" and "Guttersnipes" == "The Guttersnipes".
const tkey = s => {
  const n = norm(s).replace(/^the /, '').replace(/ /g, '');
  return TEAM_ALIAS[n] || n;
};

// ---------------------------------------------------------------------- LP HTTP

const rawCookie = readFileSync(COOKIE_FILE, 'utf8').trim();
const cookie = rawCookie.startsWith('connect.sid=') ? rawCookie : `connect.sid=${rawCookie}`;
const H = {
  Accept: 'application/json, text/plain, */*',
  'Content-Type': 'application/json',
  Cookie: cookie,
  'User-Agent': 'Mozilla/5.0',
  Origin: LP,
  Referer: LP + '/all-teams-center',
};

// A dead session returns LOGIN HTML with a 200, not a 401. Always check content-type.
async function lp(path, body) {
  const res = await fetch(LP + path, body
    ? { method: 'POST', headers: H, body: JSON.stringify(body) }
    : { headers: H });
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('json')) {
    throw new Error(`${path} -> ${res.status} ${ct}\n  Session cookie is expired or the /api prefix is wrong. ` +
      `Reminder: loadTeams/fullLeagueInfo take NO /api; loadIndividualTeam REQUIRES it.`);
  }
  return res.json();
}

const unwrap = r => (r && r.data !== undefined ? r.data : r);

// --------------------------------------------------------------------- our data

function connect() {
  const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
  for (const l of env.split('\n')) {
    const m = l.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
  return sql.connect({
    server: process.env.AZURE_SQL_SERVER,
    database: process.env.AZURE_SQL_DATABASE,
    user: process.env.AZURE_SQL_USER,
    password: process.env.AZURE_SQL_PASSWORD,
    options: { encrypt: true, trustServerCertificate: false, connectTimeout: 120000, requestTimeout: 60000 },
  });
}

async function readOurNight(pool) {
  const matches = (await pool.request().input('d', sql.Date, DATE).query(`
    SELECT s.seasonID, s.week, s.matchNumber,
           s.team1ID, t1.teamName AS t1, s.team2ID, t2.teamName AS t2
    FROM schedule s
    JOIN teams t1 ON t1.teamID = s.team1ID
    JOIN teams t2 ON t2.teamID = s.team2ID
    WHERE s.matchDate = @d
    ORDER BY s.matchNumber`)).recordset;

  if (!matches.length) throw new Error(`no schedule rows for ${DATE}`);
  const seasonID = matches[0].seasonID, week = matches[0].week;

  const teams = [];
  for (const m of matches) {
    teams.push({ teamID: m.team1ID, name: m.t1 });
    teams.push({ teamID: m.team2ID, name: m.t2 });
  }

  // 27-game rolling average as of the START of this week (what LP's Entering
  // Average should read). Floored, per the HCP rule.
  const avgRows = (await pool.request()
    .input('seasonID', sql.Int, seasonID).input('week', sql.Int, week).query(`
    SELECT b.bowlerID, b.bowlerName,
      (SELECT TOP 1 x.avg27 FROM (
         SELECT AVG(CAST(g.val AS FLOAT)) AS avg27 FROM (
           SELECT TOP 27 x2.val
           FROM scores s2
           CROSS APPLY (VALUES (s2.game1),(s2.game2),(s2.game3)) AS x2(val)
           WHERE s2.bowlerID = b.bowlerID AND s2.isPenalty = 0 AND x2.val IS NOT NULL
             AND (s2.seasonID < @seasonID OR (s2.seasonID = @seasonID AND s2.week < @week))
           ORDER BY s2.seasonID DESC, s2.week DESC) g) x) AS a
    FROM bowlers b`)).recordset;

  const avgByName = new Map();
  const dbNames = new Set();
  for (const r of avgRows) {
    dbNames.add(norm(r.bowlerName));
    if (r.a != null) avgByName.set(norm(r.bowlerName), Math.floor(r.a));
  }

  // Lineups for tonight's teams. If a team never submitted for this week we fall
  // back to the last lineup they actually bowled (Russ's rule 2026-08-10) -- their
  // averages still get refreshed, only the order is inherited.
  const ids = [...new Set(teams.map(t => t.teamID))];
  const subs = (await pool.request()
    .input('s', sql.Int, seasonID).input('w', sql.Int, week).query(`
    SELECT ls.id, ls.teamID, ls.seasonID, ls.week, le.position,
           COALESCE(b.bowlerName, le.newBowlerName) AS nm
    FROM lineupSubmissions ls
    JOIN lineupEntries le ON le.submissionID = ls.id
    LEFT JOIN bowlers b ON b.bowlerID = le.bowlerID
    WHERE ls.teamID IN (${ids.join(',')})
      AND (ls.seasonID < @s OR (ls.seasonID = @s AND ls.week <= @w))
    ORDER BY ls.teamID, ls.seasonID DESC, ls.week DESC, le.position`)).recordset;

  // Group into submissions, newest first per team.
  const byTeam = new Map();
  for (const r of subs) {
    if (!byTeam.has(r.teamID)) byTeam.set(r.teamID, new Map());
    const m = byTeam.get(r.teamID);
    if (!m.has(r.id)) m.set(r.id, { seasonID: r.seasonID, week: r.week, names: [] });
    m.get(r.id).names.push(r.nm);
  }

  const lineupOf = new Map(), inheritedFrom = new Map();
  for (const [teamID, m] of byTeam) {
    const all = [...m.values()];
    const current = all.find(s => s.seasonID === seasonID && s.week === week);
    if (current) { lineupOf.set(teamID, current.names); continue; }
    const prior = all.find(s => !(s.seasonID === seasonID && s.week === week));
    if (prior) {
      lineupOf.set(teamID, prior.names);
      inheritedFrom.set(teamID, `S${prior.seasonID} wk${prior.week}`);
    }
  }

  // The team each bowler most recently bowled FOR, per our own scores. Used to
  // break double-seat ties and to explain them in the output.
  const homeRows = (await pool.request().query(`
    SELECT b.bowlerName, t.teamName, x.teamID
    FROM bowlers b
    CROSS APPLY (SELECT TOP 1 s.teamID FROM scores s WHERE s.bowlerID = b.bowlerID
                 ORDER BY s.seasonID DESC, s.week DESC) x
    LEFT JOIN teams t ON t.teamID = x.teamID`)).recordset;
  const homeOf = new Map(homeRows.map(r => [norm(r.bowlerName), { teamID: r.teamID, teamName: r.teamName }]));

  return { seasonID, week, matches, teams, avgByName, dbNames, lineupOf, inheritedFrom, homeOf };
}

// ------------------------------------------------------------------- LP reading

async function readEvent(leagueId) {
  const lt = unwrap(await lp(`/loadTeams?fullLoad=true&id=${leagueId}&withBowlers=true`));
  const teams = (lt && lt.teams) || [];
  const fli = unwrap(await lp(`/fullLeagueInfo?id=${leagueId}`));
  const members = (fli && fli.members) || [];

  // Slot number per team _id, read off the membership rows (team[] is aligned
  // with user_team_id[]). This is the only reliable slot source via the API.
  const slotOf = new Map();
  for (const m of members) {
    const ts = m.team || [], ss = m.user_team_id || [];
    ts.forEach((t, i) => { if (ss[i] != null && !slotOf.has(t)) slotOf.set(t, ss[i]); });
  }

  // `fullLoad` is REQUIRED here -- without it you get a 400 whose msg names the
  // missing field. Archived teams keep their Team ID and their name, so this list
  // is what tells you a rename is about to collide with a ghost.
  let removed = [];
  try {
    const r = unwrap(await lp(`/getRemovedTeams?id=${leagueId}&fullLoad=true`));
    removed = (r && r.teams) || (Array.isArray(r) ? r : []);
  } catch { /* non-fatal */ }

  return { teams, members, slotOf, removed: Array.isArray(removed) ? removed : [] };
}

async function rosterOf(teamId) {
  const det = unwrap(await lp(`/api/loadIndividualTeam?id=${teamId}&noPre=false`));
  return (Array.isArray(det) ? det : []).map(b => ({
    name: b.name, email: b.email, enteringAvg: b.enteringAvg, realAvg: b.realAvg,
    // Kept for the duplicate-average check in verify(). One entry per
    // (league, team), so a team reseated onto a different slot leaves its
    // bowlers holding two rows for the SAME league.
    averages: Array.isArray(b.averages) ? b.averages : [],
  }));
}

// Rows in a bowler's `averages[]` that belong to this event. More than one means
// the bowler has been on two teams in this league -- the roster UI shows
// `enteringAvg` while the lanes can read the other row. A stale 0 is the
// "missing handicap" case (avg 0 -> the 147 max); a stale non-zero is the
// "wrong handicap" case. Diagnosed 2026-08-24: Event A had 2, B had 8 (seven of
// them Wild Llamas, slot-swapped three times), C had 1.
function dupAverages(bowler, leagueId) {
  const mine = bowler.averages.filter(a => String(a.league || '') === leagueId);
  if (mine.length < 2) return null;
  const vals = mine.map(a => Number(a.average ?? 0));
  return { vals, hasZero: vals.some(v => v === 0) };
}

// ------------------------------------------------------------------------- CSV

const COLUMNS = ['Bowler Name', 'Bowler ID', 'Email', 'Team Name', 'Team ID', 'Lineup Position',
  'Pins Carryon', 'Games Carryon', 'Entering Average', 'High Game', 'High Game Hdcp',
  'High Series', 'High Series Hdcp', 'Individual Points', 'Address', 'City', 'State',
  'Zip Code', 'Phone', 'Gender', 'Birth Date'];

const esc = v => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
const toCsv = rows => [COLUMNS.join(','), ...rows.map(r => COLUMNS.map(c => esc(r[c] ?? '')).join(','))].join('\n') + '\n';

// ------------------------------------------------------------------------ phases

async function main() {
  const pool = await connect();
  let ours;
  try { ours = await readOurNight(pool); } finally { /* keep pool for now */ }

  const { seasonID, week, matches, teams, avgByName, dbNames, lineupOf, inheritedFrom, homeOf } = ours;
  await pool.close();

  console.log(`\n=== ${DATE}  season ${seasonID} week ${week}  Event ${EVENT} ===`);
  console.log(`our field (${teams.length} teams, ${matches.length} matches):`);
  for (const m of matches) console.log(`  m${m.matchNumber}  ${m.t1} vs ${m.t2}`);

  const ev = await readEvent(LEAGUE);
  const lpByKey = new Map(ev.teams.map(t => [tkey(t.name), t]));
  const ourByKey = new Map(teams.map(t => [tkey(t.name), t]));

  // Which of our teams are already in the event, which slots are free to reuse.
  const staying = [], arriving = [];
  for (const t of teams) {
    const hit = lpByKey.get(tkey(t.name));
    if (hit) staying.push({ ...t, lpName: hit.name, lpId: hit._id, slot: ev.slotOf.get(hit._id) });
    else arriving.push(t);
  }
  const departing = ev.teams.filter(t => !ourByKey.has(tkey(t.name)))
    .map(t => ({ lpName: t.name, lpId: t._id, slot: ev.slotOf.get(t._id) }));

  console.log(`\n--- event has ${ev.teams.length} live teams, ${ev.members.length} membership rows ---`);
  for (const t of ev.teams) {
    const mine = ourByKey.has(tkey(t.name));
    console.log(`  slot ${String(ev.slotOf.get(t._id) ?? '?').padStart(2)}  ${t.name.padEnd(22)} ${mine ? '' : '<- NOT bowling tonight'}`);
  }

  console.log(`archived/removed teams still squatting on slots (${ev.removed.length}): ` +
    (ev.removed.length ? ev.removed.map(g => `${g.name} [${g.teamNumber ?? g.number ?? '?'}]`).join(', ') : 'none read'));

  // Pair arrivals onto departing slots. Renaming a departing slot avoids
  // create/archive churn and any server-side renumber pass.
  const renames = arriving.map((t, i) => ({ to: t.name, from: departing[i] })).filter(r => r.from);
  console.log(`\n--- swap plan ---`);
  if (!renames.length && !arriving.length) console.log('  no swap needed, the event already holds tonight\'s ten');
  for (const r of renames) console.log(`  slot ${r.from.slot}: "${r.from.lpName}" -> "${r.to}"`);
  if (arriving.length > departing.length) {
    console.log(`  !! ${arriving.length - departing.length} arriving team(s) have no slot to take over: ` +
      arriving.slice(departing.length).map(t => t.name).join(', '));
  }
  const ghostHit = ev.removed.filter(g => renames.some(r => tkey(r.to) === tkey(g.name)));
  if (ghostHit.length) {
    console.log(`  !! ARCHIVED team shares a name with an arriving team: ` +
      ghostHit.map(g => `${g.name} (slot ${g.teamNumber ?? g.number ?? '?'})`).join(', ') +
      `\n     Import ONE row first as a test - this is what broke Wild Llamas on 7/25.`);
  }

  if (flag('apply-renames')) {
    console.log(`\n--- applying ${renames.length} rename(s) ---`);
    for (const r of renames) {
      const res = await lp('/updateTeam', { type: 'name', id: r.from.lpId, name: r.to });
      console.log(`  ${r.from.lpName} -> ${r.to}: ${JSON.stringify(res).slice(0, 80)}`);
    }
    console.log('  re-run without --apply-renames to build the CSV against the new names');
    return;
  }
  if (renames.length) {
    console.log(`\n  Renames NOT applied. Re-run with --apply-renames, then run plan again.`);
  }

  // ---- roster sourcing. Staying teams keep their event roster; arriving teams
  // come from the C league (the only place their real roster lives).
  const cEvent = LEAGUE === EVENTS.C ? ev : await readEvent(EVENTS.C);
  const cByKey = new Map(cEvent.teams.map(t => [tkey(t.name), t]));

  const rosters = new Map(), sourceOf = new Map(), staleSlots = [];
  for (const t of teams) {
    const inEvent = staying.find(s => s.teamID === t.teamID);
    const c = cByKey.get(tkey(t.name));
    const cRoster = c ? await rosterOf(c._id) : [];
    if (!c && !inEvent) {
      console.log(`  !! ${t.name} is in neither this event nor the C league - cannot source a roster`);
      rosters.set(t.teamID, []); sourceOf.set(t.teamID, 'C'); continue;
    }
    if (!inEvent) { rosters.set(t.teamID, cRoster); sourceOf.set(t.teamID, 'C'); continue; }

    // A slot that was renamed for tonight's swap still physically holds the
    // DEPARTED team's bowlers. Detect that by overlap with the canonical C
    // roster, so the swap works whether or not the rename already ran.
    const evRoster = await rosterOf(inEvent.lpId);
    const cKeys = new Set(cRoster.map(b => bkey(b.name)));
    const shared = evRoster.filter(b => cKeys.has(bkey(b.name))).length;
    if (cRoster.length && shared / cRoster.length < 0.4) {
      rosters.set(t.teamID, cRoster); sourceOf.set(t.teamID, 'C');
      staleSlots.push(`${t.name}: slot ${inEvent.slot} still holds a different squad ` +
        `(only ${shared}/${cRoster.length} names match) -> sourcing from the C league instead`);
    } else { rosters.set(t.teamID, evRoster); sourceOf.set(t.teamID, 'event'); }
  }
  if (staleSlots.length) {
    console.log(`\n--- renamed slots detected ---`);
    staleSlots.forEach(s => console.log(`  ${s}`));
  }

  const lineupNames = new Map(); // bkey -> [teamID] where they are in the lineup
  for (const [teamID, ln] of lineupOf) {
    if (!teams.some(t => t.teamID === teamID)) continue;
    for (const n of ln) {
      if (!lineupNames.has(bkey(n))) lineupNames.set(bkey(n), []);
      lineupNames.get(bkey(n)).push(teamID);
    }
  }

  // ---- adds: a bowler in the lineup who is not on the sourced roster.
  const searchCache = new Map();
  async function findOnLp(name) {
    if (searchCache.has(name)) return searchCache.get(name);
    let out = null;
    for (const q of [name, name.split(' ').filter((_, i, a) => i === 0 || i === a.length - 1).join(' ')]) {
      const res = unwrap(await lp('/searchUsers', { q, exact: true, origin: 'AllTeamsCenter' })) || [];
      const list = Array.isArray(res) ? res : [];
      const hit = list.find(u => bkey(u.name) === bkey(name)) || (list.length === 1 ? list[0] : null);
      if (hit && hit.email) { out = { name: hit.name, email: hit.email }; break; }
    }
    searchCache.set(name, out);
    return out;
  }

  const notes = { unmatched: [], noAvg: [], noLineup: [], inherited: [], shortLineup: [], added: [], dropped: [], needsInvite: [], conflict: [] };

  // PHASE A: assemble each team's roster (adds included), no dedupe yet.
  const final = new Map();
  for (const t of teams) {
    let roster = (rosters.get(t.teamID) || []).slice();
    const ln = lineupOf.get(t.teamID) || [];
    if (!ln.length) notes.noLineup.push(t.name);
    else if (inheritedFrom.has(t.teamID)) notes.inherited.push(`${t.name}: reusing ${inheritedFrom.get(t.teamID)} -> ${ln.join(', ')}`);
    if (ln.length && ln.length < 4) notes.shortLineup.push(`${t.name} (${ln.length} of 4: ${ln.join(', ')})`);

    for (const n of ln) {
      if (roster.some(b => bkey(b.name) === bkey(n))) continue;
      const found = await findOnLp(n);
      if (found) { roster.push(found); notes.added.push(`${n} -> ${t.name}`); }
      else {
        // Not on LP at all. Seat them anyway on a placeholder address: Team Import
        // CREATES the user (proven on Jack Marone, 8/03), and the fake domain means
        // nothing is deliverable even if a disable-email box gets missed. Dropping
        // them instead is worse than it looks -- everyone below shifts up a slot and
        // a non-lineup bowler lands in the top four, which is what LP computes the
        // team average and handicap from.
        const email = `${norm(n).replace(/ /g, '.')}@splitzkrieg.placeholder`;
        roster.push({ name: n, email });
        notes.needsInvite.push(`${n} (${t.name}) -> seated as ${email}`);
      }
    }
    final.set(t.teamID, roster);
  }

  // PHASE B: nobody may appear twice in the file -- a duplicate risks the whole
  // row being rejected with "already in the league". Resolution order:
  //   1. the team whose LINEUP they are in (that is where they bowl tonight)
  //   2. failing that, the C-sourced roster (their canonical team) over an
  //      event leftover
  //   3. failing that, keep the first and say so
  const seatedOn = new Map();
  for (const [teamID, r] of final) for (const b of r) {
    if (!seatedOn.has(bkey(b.name))) seatedOn.set(bkey(b.name), []);
    seatedOn.get(bkey(b.name)).push(teamID);
  }
  const nameOfTeam = id => (teams.find(t => t.teamID === id) || {}).name || id;
  for (const [k, ids] of seatedOn) {
    if (ids.length < 2) continue;
    const claimants = ids.filter(id => (lineupNames.get(k) || []).includes(id));
    let keep, why;
    if (claimants.length === 1) { keep = claimants[0]; why = 'in their lineup'; }
    else if (claimants.length > 1) {
      keep = claimants[0];
      notes.conflict.push(`${k} is in TWO lineups tonight (${claimants.map(nameOfTeam).join(' + ')}) - seated on ${nameOfTeam(keep)}, CHECK THIS`);
      why = 'first of two lineup claims';
    } else {
      const cSrc = ids.filter(id => sourceOf.get(id) === 'C');
      keep = cSrc.length === 1 ? cSrc[0] : ids[0];
      const home = homeOf.get(k);
      why = `not in any lineup tonight; ours has him last bowling for ${home ? home.teamName : 'unknown'}`;
    }
    for (const id of ids) {
      if (id === keep) continue;
      final.set(id, final.get(id).filter(b => bkey(b.name) !== k));
    }
    notes.dropped.push(`${k}: kept on ${nameOfTeam(keep)}, removed from ${ids.filter(i => i !== keep).map(nameOfTeam).join(', ')} (${why})`);
  }

  // PHASE C: order the lineup on top and emit rows.
  const rows = [];
  for (const t of teams) {
    const ln = lineupOf.get(t.teamID) || [];
    const rank = b => {
      const i = ln.findIndex(n => bkey(n) === bkey(b.name));
      return i === -1 ? 999 : i;
    };
    const roster = final.get(t.teamID)
      .map((b, i) => ({ b, i })).sort((x, y) => rank(x.b) - rank(y.b) || x.i - y.i).map(x => x.b);

    roster.forEach((b, i) => {
      const k = bkey(b.name);
      if (!dbNames.has(k)) notes.unmatched.push(`${t.name}: ${b.name}`);
      const avg = avgByName.get(k);
      if (avg == null) notes.noAvg.push(`${t.name}: ${b.name}`);
      const row = Object.fromEntries(COLUMNS.map(c => [c, '']));
      row['Bowler Name'] = b.name;
      row['Email'] = b.email || '';
      row['Team Name'] = staying.find(s => s.teamID === t.teamID)?.lpName || t.name;
      row['Team ID'] = '';                       // blank -> match on Team Name
      row['Lineup Position'] = String(i + 1);
      row['Entering Average'] = avg != null ? String(avg) : '';
      rows.push(row);
    });
  }

  const stamp = DATE.slice(5).replace('-', '');
  const full = `${OUT}/lp-${EVENT}-${stamp}-FULL.csv`;
  const test = `${OUT}/lp-${EVENT}-${stamp}-TEST.csv`;
  writeFileSync(full, toCsv(rows));
  // The test row should target whichever team is actually risky: one whose name an
  // archived team also holds. That is the case a 1-row upload is meant to catch.
  const risky = rows.find(r => ev.removed.some(g => tkey(g.name) === tkey(r['Team Name'])));
  writeFileSync(test, toCsv([risky || rows[0]]));

  console.log(`\n--- roster summary ---`);
  console.log('team                   seats  top4avg  lineup');
  for (const t of teams) {
    const mine = rows.filter(r => r['Team Name'] === (staying.find(s => s.teamID === t.teamID)?.lpName || t.name));
    const top4 = mine.slice(0, 4).reduce((n, r) => n + (parseInt(r['Entering Average'], 10) || 0), 0);
    const ln = lineupOf.get(t.teamID) || [];
    const src = !ln.length ? 'NONE (roster order)'
      : inheritedFrom.has(t.teamID) ? `${ln.length} inherited from ${inheritedFrom.get(t.teamID)}`
      : `${ln.length} submitted`;
    console.log(`  ${t.name.padEnd(20)} ${String(mine.length).padStart(4)}  ${String(top4).padStart(7)}  ${src}`);
  }
  console.log(`\nTOTAL ROWS: ${rows.length}`);

  const report = [
    ['no lineup submitted, reusing their last one', notes.inherited],
    ['no lineup at all, not even a prior one', notes.noLineup],
    ['lineup shorter than 4', notes.shortLineup],
    ['auto-added to roster (found on LP)', notes.added],
    ['double-seat resolved', notes.dropped],
    ['SAME BOWLER IN TWO LINEUPS - needs your call', notes.conflict],
    ['NOT ON LP - seated on a placeholder address, the import creates the account', notes.needsInvite],
    ['not matched to our bowlers table', notes.unmatched],
    ['blank Entering Average', notes.noAvg],
  ];
  for (const [label, list] of report) {
    if (!list.length) continue;
    console.log(`\n!! ${label} (${list.length}):`);
    list.forEach(s => console.log(`   ${s}`));
  }

  const dupes = [...rows.reduce((m, r) => {
    const k = bkey(r['Bowler Name']);
    if (!m.has(k)) m.set(k, new Set());
    m.get(k).add(r['Team Name']);
    return m;
  }, new Map()).entries()].filter(([, s]) => s.size > 1);
  if (dupes.length) {
    console.log(`\n!! seated on two teams (${dupes.length}):`);
    dupes.forEach(([n, s]) => console.log(`   ${n} -> ${[...s].join(' + ')}`));
  } else console.log('\nno cross-team double seating');

  console.log(`\nCSV:  ${full}`);
  console.log(`TEST: ${test}   (one row, upload first if an archived team shares a name)`);
  console.log(`\nUpload: Manage Teams -> New Team -> Team Import -> Select CSV File`);
  console.log(`        Update toggle ON, BOTH "disable email" boxes CHECKED.`);
  console.log(`Then:   node scripts/lp-prep-night.mjs --date=${DATE} --event=${EVENT} --cookie-file=... --verify`);
}

// ------------------------------------------------------------------ verify phase

async function verify() {
  const pool = await connect();
  const ours = await readOurNight(pool);
  await pool.close();

  const ev = await readEvent(LEAGUE);
  const ourByKey = new Map(ours.teams.map(t => [tkey(t.name), t]));
  const liveIds = new Set(ev.teams.map(t => t._id));
  const memByEmail = new Map(ev.members.map(m => [String(m.email || '').toLowerCase(), m]));

  let seats = 0;
  const seatNoMember = [], avgBad = [], orderBad = [], dupLineup = [], dupBench = [];
  console.log(`\n=== VERIFY ${DATE} Event ${EVENT} ===`);
  console.log('team                   seats  top4(LP)  lineup order');

  for (const t of ev.teams) {
    const mine = ourByKey.get(tkey(t.name));
    const roster = await rosterOf(t._id);
    seats += roster.length;

    const ln = mine ? (ours.lineupOf.get(mine.teamID) || []) : [];
    const bowlingTonight = new Set(ln.map(n => bkey(n)));

    for (const b of roster) {
      const m = memByEmail.get(String(b.email || '').toLowerCase());
      if (!m || !(m.team || []).some(x => liveIds.has(x))) seatNoMember.push(`${t.name}: ${b.name}`);
      const expAvg = ours.avgByName.get(bkey(b.name));
      if (expAvg != null && Number(b.enteringAvg) !== expAvg) {
        avgBad.push(`${t.name}: ${b.name} LP=${b.enteringAvg} ours=${expAvg}`);
      }
      const dup = dupAverages(b, LEAGUE);
      if (dup) {
        const why = dup.hasZero ? 'stale 0 -> lanes may apply the 147 max'
          : `lanes may use ${dup.vals.find(v => v !== Number(b.enteringAvg)) ?? '?'}`;
        const line = `${t.name}: ${b.name} enteringAvg=${b.enteringAvg} averages[]=[${dup.vals.join(',')}]  ${why}`;
        (bowlingTonight.has(bkey(b.name)) ? dupLineup : dupBench).push(line);
      }
    }

    let orderOK = true;
    if (ln.length) {
      const lpTop = roster.slice(0, ln.length).map(b => bkey(b.name)).join('|');
      const exTop = ln.map(n => bkey(n)).join('|');
      orderOK = lpTop === exTop;
      if (!orderOK) orderBad.push(`${t.name}\n      LP:   ${roster.slice(0, ln.length).map(b => b.name).join(' | ')}\n      ours: ${ln.join(' | ')}`);
    }
    const top4 = roster.slice(0, 4).reduce((n, b) => n + (Number(b.enteringAvg) || 0), 0);
    console.log(`  ${t.name.padEnd(20)} ${String(roster.length).padStart(4)}  ${String(top4).padStart(8)}  ` +
      `${!mine ? 'not bowling tonight' : ln.length ? (orderOK ? 'OK' : '** OFF **') : 'no submission'}`);
  }

  console.log(`\nSEATS=${seats}  MEMBERS=${ev.members.length}`);
  const orphans = ev.members.filter(m => !(m.team || []).some(x => liveIds.has(x)));
  console.log(`\n*** seats with NO live membership row (the disease): ${seatNoMember.length}`);
  seatNoMember.forEach(s => console.log('   ' + s));
  console.log(`\nmembership rows with no live team (cosmetic leftovers): ${orphans.length}`);
  if (orphans.length) console.log('   ' + orphans.map(m => m.userName).join(', '));
  console.log(`\nentering-average mismatches: ${avgBad.length}`);
  avgBad.forEach(s => console.log('   ' + s));
  console.log(`\nlineup-order mismatches: ${orderBad.length}`);
  orderBad.forEach(s => console.log('   ' + s));

  // Two rows for one league. Only a fail when the bowler actually bowls tonight;
  // on the bench it is exposure to watch, not a reason to block the night.
  console.log(`\n*** duplicate averages[] rows, bowler IN TONIGHT'S LINEUP: ${dupLineup.length}`);
  dupLineup.forEach(s => console.log('   ' + s));
  console.log(`\nduplicate averages[] rows, bench only (watch, not blocking): ${dupBench.length}`);
  dupBench.forEach(s => console.log('   ' + s));

  const clean = !seatNoMember.length && !avgBad.length && !orderBad.length && !dupLineup.length;
  console.log(`\n${clean ? 'ALL CLEAR' : '*** PROBLEMS ABOVE ***'}`);
  if (!clean) process.exitCode = 1;
}

// ------------------------------------------------------------------- lanes phase

async function lanes() {
  const pool = await connect();
  const ours = await readOurNight(pool);
  await pool.close();

  const ev = await readEvent(LEAGUE);
  const nameOf = new Map(ev.teams.map(t => [t._id, t.name]));
  const ln = unwrap(await lp(`/laneSchedule?league_id=${LEAGUE}`));
  const wk = ((ln && ln.schedule) || []).find(w => String(w.date).slice(0, 10) === DATE);

  console.log(`\n=== LANES ${DATE} Event ${EVENT} ===`);
  if (!wk) {
    console.log(`  no lane schedule row for ${DATE}. Dates present: ` +
      ((ln && ln.schedule) || []).map(w => String(w.date).slice(0, 10)).join(', '));
    process.exitCode = 1;
    return;
  }

  const got = wk.matches.map(m => ({
    l1: m.team1_lane, l2: m.team2_lane,
    n1: nameOf.get(m.team1_id) || '?', n2: nameOf.get(m.team2_id) || '?',
    s1: ev.slotOf.get(m.team1_id), s2: ev.slotOf.get(m.team2_id),
  })).sort((a, b) => a.l1 - b.l1);

  // Compare PAIRINGS as an unordered set. Which lane a match sits on does not
  // matter; who plays whom does.
  const pairKey = (a, b) => [tkey(a), tkey(b)].sort().join(' vs ');
  const wanted = new Map(ours.matches.map(m => [pairKey(m.t1, m.t2), `${m.t1} v ${m.t2}`]));
  const matched = new Set();

  let bad = 0;
  for (const r of got) {
    const k = pairKey(r.n1, r.n2);
    const ok = wanted.has(k);
    if (ok) matched.add(k); else bad++;
    console.log(`  lanes ${String(r.l1).padStart(2)}/${String(r.l2).padStart(2)}: ` +
      `${r.n1} (${r.s1}) vs ${r.n2} (${r.s2})   ${ok ? 'OK' : '** NOT ONE OF OUR MATCHUPS **'}`);
  }

  const missing = [...wanted.entries()].filter(([k]) => !matched.has(k)).map(([, v]) => v);
  if (missing.length) {
    console.log(`\nour matchups NOT on the lane sheet (${missing.length}):`);
    missing.forEach(m => console.log(`   ${m}`));
  }
  console.log(`\nslot order as entered: ${got.flatMap(r => [r.s1, r.s2]).join(' ')}`);

  if (bad) {
    // What to type into the Schedule tab. Pairings already correct keep their
    // lanes; the rest fill the remaining lane pairs in schedule order.
    const slotOfName = new Map(ev.teams.map(t => [tkey(t.name), ev.slotOf.get(t._id)]));
    const keep = got.filter(r => wanted.has(pairKey(r.n1, r.n2)));
    const freeLanes = got.filter(r => !wanted.has(pairKey(r.n1, r.n2))).map(r => [r.l1, r.l2]);
    const toPlace = ours.matches.filter(m => !matched.has(pairKey(m.t1, m.t2)));
    const plan = [
      ...keep.map(r => ({ l1: r.l1, l2: r.l2, a: r.n1, b: r.n2, s1: r.s1, s2: r.s2, note: 'unchanged' })),
      ...toPlace.map((m, i) => ({
        l1: freeLanes[i] ? freeLanes[i][0] : '?', l2: freeLanes[i] ? freeLanes[i][1] : '?',
        a: m.t1, b: m.t2, s1: slotOfName.get(tkey(m.t1)), s2: slotOfName.get(tkey(m.t2)), note: 'CHANGE',
      })),
    ].sort((x, y) => x.l1 - y.l1);

    console.log(`\n--- enter this in the Schedule tab for ${DATE} ---`);
    for (const p of plan) {
      console.log(`  lanes ${String(p.l1).padStart(2)}/${String(p.l2).padStart(2)}:  ` +
        `slot ${String(p.s1).padStart(2)} vs slot ${String(p.s2).padStart(2)}   ` +
        `${p.a} v ${p.b}${p.note === 'CHANGE' ? '   <- CHANGE' : ''}`);
    }
    console.log(`  slot order across lanes 1-10:  ${plan.flatMap(p => [p.s1, p.s2]).join(' ')}`);
  }
  console.log(`\n${bad ? `*** ${bad} of ${got.length} PAIRINGS WRONG - fix by hand in the Schedule tab (no write endpoint) ***` : 'ALL PAIRINGS CORRECT'}`);
  if (bad) process.exitCode = 1;
}

const run = flag('verify') ? verify : flag('lanes') ? lanes : main;
run().catch(e => { console.error('\nFAILED:', e.message); process.exit(1); });
