#!/usr/bin/env node
/**
 * Build a LeaguePals Team Import CSV for one split-phase event night.
 *
 * Sources rosters from a JSON dump of the C-league teams (names + emails, the LP
 * match key), matches each bowler to our DB, injects our 27-game rolling average
 * as `Entering Average`, and orders the top of each roster from `lineupSubmissions`.
 *
 * The CSV is parsed by LeaguePals by COLUMN POSITION, not header name, so all 21
 * columns are always emitted even when blank. See memory/feedback_lp_team_import.md.
 *
 * Usage:
 *   node scripts/gen-lp-event-csv.mjs --rosters=<path.json> --season=36 --week=2 \
 *     [--out=<path.csv>]
 */
import sql from 'mssql';
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const env = readFileSync(resolve(ROOT, '.env.local'), 'utf8');
for (const l of env.split('\n')) { const m = l.match(/^([^#=]+)=(.*)$/); if (m) process.env[m[1].trim()] = m[2].trim(); }
const dbConfig = {
  server: process.env.AZURE_SQL_SERVER, database: process.env.AZURE_SQL_DATABASE,
  user: process.env.AZURE_SQL_USER, password: process.env.AZURE_SQL_PASSWORD,
  options: { encrypt: true, trustServerCertificate: false, connectTimeout: 120000, requestTimeout: 60000 },
};

const arg = (k, d) => {
  const hit = process.argv.find(a => a.startsWith(`--${k}=`));
  return hit ? hit.split('=').slice(1).join('=') : d;
};
const ROSTER_PATH = arg('rosters');
const SEASON = parseInt(arg('season', '36'), 10);
const WEEK = parseInt(arg('week', '2'), 10);
const OUT = arg('out', resolve(ROOT, `lp-event-s${SEASON}-w${WEEK}.csv`));
// LeaguePals rejects a Team ID that any team holds, INCLUDING archived ones. Leaving the
// column blank makes the importer match on Team Name instead. See project_s36_setup.md.
const BLANK_TEAM_ID = process.argv.includes('--blank-team-id');
if (!ROSTER_PATH) { console.error('Missing --rosters=<path.json>'); process.exit(1); }

// LP team name -> our teams.teamID, and the LP team slot number in the event.
// Slots read live from Event A membership rows on 2026-07-25.
const TEAM_META = {
  'The Guttersnipes':    { teamID: 13, slot: 1 },
  'Pin Ups':             { teamID: 22, slot: 2 },
  'Wild Llamas':         { teamID: 42, slot: 3 },  // renamed from Living on a Spare
  'Thoughts and Spares': { teamID: 38, slot: 4 },  // renamed from Guttermouths
  'Valley of the Balls': { teamID: 39, slot: 5 },
  'Alley Oops':          { teamID: 1,  slot: 6 },
  'E Bowla':             { teamID: 7,  slot: 7 },
  "Grandma's Teeth":     { teamID: 9,  slot: 8 },
  'Bowl Durham':         { teamID: 4,  slot: 9, lpName: 'High Rollers' },
  'Hot Shotz':           { teamID: 15, slot: 10 },
};

// LP spelling -> our DB bowlerName. See memory/feedback_lp_team_import.md.
const NAME_ALIAS = {
  'glenn booth': 'Glenn Boothe',
  'annie segrest': 'Annie Seagrest',
  'jennifer peters': 'J Peters',
  'farrell farrell': 'Farrell',
  'anthony bennett': 'Anthony Bennet',
  'jessa witzel': 'Jessa Carpenter',
  'emma richardson': 'Emma Jane Richardson',
  'nick hicks': 'Daz Hicks',
  'clark b': 'Clark Brunner',
  'colin henrahen': 'Colin Henrahan',
  'ian mccarthy': 'Ian McCarthy',
  'mike depasquale': 'Mike DePasquale',
};

const norm = (s) => s.toLowerCase().replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim();

const COLUMNS = [
  'Bowler Name', 'Bowler ID', 'Email', 'Team Name', 'Team ID', 'Lineup Position',
  'Pins Carryon', 'Games Carryon', 'Entering Average', 'High Game', 'High Game Hdcp',
  'High Series', 'High Series Hdcp', 'Individual Points', 'Address', 'City', 'State',
  'Zip Code', 'Phone', 'Gender', 'Birth Date',
];

async function main() {
  const rosters = JSON.parse(readFileSync(ROSTER_PATH, 'utf8'));
  const pool = await sql.connect(dbConfig);

  // Our bowlers, for name matching.
  const bowlers = (await pool.request().query(
    `SELECT bowlerID, bowlerName FROM bowlers`,
  )).recordset;
  const byName = new Map();
  for (const b of bowlers) {
    const k = norm(b.bowlerName);
    if (!byName.has(k)) byName.set(k, []);
    byName.get(k).push(b);
  }

  // 27-game rolling average as of this season/week (the incoming average).
  const avgRows = (await pool.request()
    .input('seasonID', sql.Int, SEASON)
    .input('week', sql.Int, WEEK)
    .query(`
      SELECT b.bowlerID,
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
    `)).recordset;
  const avgMap = new Map();
  for (const r of avgRows) if (r.incomingAvg != null) avgMap.set(r.bowlerID, Math.floor(r.incomingAvg));

  // Submitted lineups for this week -> desired roster order.
  const subs = (await pool.request()
    .input('seasonID', sql.Int, SEASON)
    .input('week', sql.Int, WEEK)
    .query(`
      SELECT ls.teamID, le.bowlerID, le.newBowlerName, le.position,
             b.bowlerName
      FROM lineupSubmissions ls
      JOIN lineupEntries le ON le.submissionID = ls.id
      LEFT JOIN bowlers b ON b.bowlerID = le.bowlerID
      WHERE ls.seasonID = @seasonID AND ls.week = @week
      ORDER BY ls.teamID, le.position
    `)).recordset;
  const lineupByTeam = new Map();
  for (const r of subs) {
    if (!lineupByTeam.has(r.teamID)) lineupByTeam.set(r.teamID, []);
    lineupByTeam.get(r.teamID).push({
      bowlerID: r.bowlerID,
      name: r.bowlerName || r.newBowlerName,
      isNew: r.bowlerID == null,
    });
  }

  const rows = [];
  const unmatched = [];
  const noAvg = [];
  const missingFromRoster = [];
  const seenEmail = new Map();

  for (const [lpTeam, roster] of Object.entries(rosters)) {
    const meta = TEAM_META[lpTeam];
    if (!meta) { console.error(`No TEAM_META for "${lpTeam}"`); continue; }
    const teamNameOut = meta.lpName || lpTeam;

    const resolved = roster.map(([name, email]) => {
      const key = norm(NAME_ALIAS[norm(name)] || name);
      const hits = byName.get(key) || [];
      if (hits.length !== 1) unmatched.push({ lpTeam, name, email, hits: hits.length });
      const b = hits.length === 1 ? hits[0] : null;
      const avg = b ? avgMap.get(b.bowlerID) : undefined;
      if (b && avg == null) noAvg.push({ lpTeam, name, bowlerID: b.bowlerID });
      return { name, email, bowlerID: b ? b.bowlerID : null, avg };
    });

    // Order: submitted lineup first (in submitted order), then everyone else.
    // Match on bowlerID where we have one, else on name, so free-text entries for
    // brand-new bowlers still order correctly.
    const want = lineupByTeam.get(meta.teamID) || [];
    const idxOf = (r) => want.findIndex(w =>
      (w.bowlerID != null && w.bowlerID === r.bowlerID) || norm(w.name) === norm(r.name));
    const rank = (r) => { const i = idxOf(r); return i === -1 ? 999 : i; };
    resolved.sort((a, b) => rank(a) - rank(b));

    // A submitted bowler who is not on the roster would otherwise be silently
    // dropped and the rest pulled up a slot. Surface it.
    for (const w of want) {
      const onRoster = resolved.some(r =>
        (w.bowlerID != null && w.bowlerID === r.bowlerID) || norm(w.name) === norm(r.name));
      if (!onRoster) missingFromRoster.push({ lpTeam: teamNameOut, name: w.name, isNew: w.isNew });
    }

    resolved.forEach((r, i) => {
      // Track cross-team duplicates. Key on our bowlerID where we have one, so
      // the same person under two LP accounts is caught as well as one account
      // rostered twice.
      const dupKey = r.bowlerID != null ? `#${r.bowlerID} ${r.name}` : r.email;
      if (!seenEmail.has(dupKey)) seenEmail.set(dupKey, []);
      seenEmail.get(dupKey).push(`${teamNameOut} <${r.email}>`);

      const row = Object.fromEntries(COLUMNS.map(c => [c, '']));
      row['Bowler Name'] = r.name;
      row['Email'] = r.email;
      row['Team Name'] = teamNameOut;
      row['Team ID'] = BLANK_TEAM_ID ? '' : String(meta.slot);
      row['Lineup Position'] = String(i + 1);
      row['Entering Average'] = r.avg != null ? String(r.avg) : '';
      rows.push(row);
    });
  }

  const esc = (v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const csv = [COLUMNS.join(','), ...rows.map(r => COLUMNS.map(c => esc(r[c])).join(','))].join('\n') + '\n';
  writeFileSync(OUT, csv);

  console.log(`Wrote ${OUT}`);
  console.log(`  ${rows.length} bowler rows across ${Object.keys(rosters).length} teams`);
  console.log(`  lineups applied for teamIDs: ${[...lineupByTeam.keys()].join(', ') || 'none'}`);

  const dupes = [...seenEmail.entries()].filter(([, t]) => t.length > 1);
  if (dupes.length) {
    console.log(`\n!! ${dupes.length} bowler(s) seated on TWO teams the same night:`);
    for (const [email, teams] of dupes) console.log(`   ${email} -> ${teams.join(' + ')}`);
  }
  if (unmatched.length) {
    console.log(`\n!! ${unmatched.length} unmatched to our DB (blank Entering Average):`);
    for (const u of unmatched) console.log(`   ${u.lpTeam}: "${u.name}" (${u.hits} matches) ${u.email}`);
  }
  if (missingFromRoster.length) {
    console.log(`\n!! ${missingFromRoster.length} submitted bowler(s) NOT on the roster (would be dropped):`);
    for (const m of missingFromRoster) {
      console.log(`   ${m.lpTeam}: ${m.name}${m.isNew ? '  [NEW - no bowlers row, no LP account]' : ''}`);
    }
  }
  if (noAvg.length) {
    console.log(`\n!! ${noAvg.length} matched but no rolling average (no-average bowler -> 219 rule):`);
    for (const n of noAvg) console.log(`   ${n.lpTeam}: ${n.name} (bowlerID ${n.bowlerID})`);
  }

  await pool.close();
}

main().catch(e => { console.error(e); process.exit(1); });
