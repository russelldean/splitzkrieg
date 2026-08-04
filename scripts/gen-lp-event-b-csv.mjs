#!/usr/bin/env node
/**
 * Build the LeaguePals Team Import CSV for Event B, night 8/03 (S36 week 2, 2nd half).
 *
 * Rosters are sourced LIVE: staying teams from Event B itself, the two incoming teams
 * from the C league. Entering Average is our 27-game rolling number as of S36 wk2, and
 * Lineup Position comes from lineupSubmissions.
 *
 * The CSV is parsed by COLUMN POSITION, not header name -> all 21 columns always emitted.
 * Team ID is left blank so the importer matches on Team Name.
 *
 * Usage: node scripts/tmp-gen-lp-event-b.mjs --cookie-file=<path> --out=<dir> [--test]
 */
import sql from 'mssql';
import { readFileSync, writeFileSync } from 'fs';

const LP = 'https://www.leaguepals.com';
const arg = (k, d) => {
  const hit = process.argv.find(a => a.startsWith(`--${k}=`));
  return hit ? hit.split('=').slice(1).join('=') : d;
};
const COOKIE_FILE = arg('cookie-file');
const OUT = arg('out');
const B = '69ff6c824e0fec0b32dcbef8';
const C = '69ff6fa7d824a6df6ec83597';
const SEASON = 36, WEEK = 2;

const env = readFileSync('/Users/russdean/Projects/splitzkrieg/.env.local', 'utf8');
for (const l of env.split('\n')) { const m = l.match(/^([^#=]+)=(.*)$/); if (m) process.env[m[1].trim()] = m[2].trim(); }

const raw = readFileSync(COOKIE_FILE, 'utf8').trim();
const cookie = raw.startsWith('connect.sid=') ? raw : `connect.sid=${raw}`;
const H = { Accept: 'application/json, text/plain, */*', 'Content-Type': 'application/json', Cookie: cookie, 'User-Agent': 'Mozilla/5.0', Origin: LP, Referer: LP + '/all-teams-center' };
const g = async p => { const r = await fetch(LP + p, { headers: H }); return r.json(); };

// LP spelling -> our DB bowlerName.
const ALIAS = {
  'anthony bennett': 'Anthony Bennet', 'jessa witzel': 'Jessa Carpenter',
  'emma richardson': 'Emma Jane Richardson', 'nick hicks': 'Daz Hicks',
  'clark b': 'Clark Brunner', 'colin henrahen': 'Colin Henrahan',
  'ian mccarthy': 'Ian McCarthy', 'annie segrest': 'Annie Seagrest',
  'glenn booth': 'Glenn Boothe', 'nate boden': 'Nathan Boden',
  'geoff berry': 'Geoffrey Berry', 'val faulkner': 'Valerie Faulkner',
};
const norm = s => String(s).toLowerCase().replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim();
const key = s => norm(ALIAS[norm(s)] || s);

// Tonight's ten. `src` = where the roster comes from.
const TONIGHT = [
  { teamID: 8,  lp: 'Fancy Pants',       src: 'B' },
  { teamID: 11, lp: 'Gutterglory',       src: 'B' },
  { teamID: 12, lp: 'Guttermouths',      src: 'C' },
  { teamID: 18, lp: 'Lucky Strikes',     src: 'B' },
  { teamID: 17, lp: 'Living on a Spare', src: 'C' },
  { teamID: 31, lp: 'Stinky Cheese',     src: 'B' },
  { teamID: 14, lp: 'HOT FUN',           src: 'B' },
  { teamID: 33, lp: 'The Boom Kings',    src: 'B' },
  { teamID: 28, lp: 'Sparadigm Shift',   src: 'B' },
  { teamID: 26, lp: 'Smoke a Bowl',      src: 'B' },
];

// Bowlers to add who are not on the sourced roster, and bowlers to drop from it.
const ADD = {
  'Guttermouths':      [{ name: 'Julie Doring',  email: 'julie.doring.lp@mailinator.com' }],
  'Living on a Spare': [{ name: 'Jack Marone',   email: 'jack.marone@splitzkrieg.placeholder' }],
  'The Boom Kings':    [{ name: 'Melissa Lee',   email: 'mdawalee@gmail.com' }],
  'Sparadigm Shift':   [{ name: 'Erik Ramquist', email: 'erik.ramquist.lp@mailinator.com' }],
};
// Melissa Lee is rostered on Guttermouths in the C league but is subbing for The Boom
// Kings tonight. Seat her only where she bowls -- one person on two teams in the same
// file risks the "already in the league" rejection.
const DROP = { 'Guttermouths': ['Melissa Lee'] };

const COLUMNS = ['Bowler Name', 'Bowler ID', 'Email', 'Team Name', 'Team ID', 'Lineup Position',
  'Pins Carryon', 'Games Carryon', 'Entering Average', 'High Game', 'High Game Hdcp',
  'High Series', 'High Series Hdcp', 'Individual Points', 'Address', 'City', 'State',
  'Zip Code', 'Phone', 'Gender', 'Birth Date'];

const main = async () => {
  // Live rosters.
  const rosterOf = {};
  for (const src of ['B', 'C']) {
    const lt = await g(`/loadTeams?fullLoad=true&id=${src === 'B' ? B : C}&withBowlers=true`);
    for (const t of (lt.data && lt.data.teams) || []) {
      const need = TONIGHT.find(x => x.lp === t.name && x.src === src);
      if (!need) continue;
      const det = await g(`/api/loadIndividualTeam?id=${t._id}&noPre=false`);
      rosterOf[t.name] = ((det && det.data) || det).map(b => ({ name: b.name, email: b.email }));
    }
  }

  const pool = await sql.connect({ server: process.env.AZURE_SQL_SERVER, database: process.env.AZURE_SQL_DATABASE, user: process.env.AZURE_SQL_USER, password: process.env.AZURE_SQL_PASSWORD, options: { encrypt: true, trustServerCertificate: false, connectTimeout: 120000, requestTimeout: 60000 } });

  const avgRows = (await pool.request().input('seasonID', sql.Int, SEASON).input('week', sql.Int, WEEK).query(`
    SELECT b.bowlerID, b.bowlerName,
      (SELECT TOP 1 x.avg27 FROM (SELECT AVG(CAST(g.val AS FLOAT)) AS avg27 FROM (
        SELECT TOP 27 x2.val FROM scores s2 CROSS APPLY (VALUES (s2.game1),(s2.game2),(s2.game3)) AS x2(val)
        WHERE s2.bowlerID=b.bowlerID AND s2.isPenalty=0 AND x2.val IS NOT NULL
          AND (s2.seasonID<@seasonID OR (s2.seasonID=@seasonID AND s2.week<@week))
        ORDER BY s2.seasonID DESC, s2.week DESC) g) x) AS a
    FROM bowlers b`)).recordset;
  const avgByName = new Map();
  for (const r of avgRows) if (r.a != null) avgByName.set(norm(r.bowlerName), Math.floor(r.a));
  const dbNames = new Set(avgRows.map(r => norm(r.bowlerName)));

  const subs = (await pool.request().input('s', sql.Int, SEASON).input('w', sql.Int, WEEK).query(`
    SELECT ls.teamID, le.position, le.newBowlerName, b.bowlerName
    FROM lineupSubmissions ls JOIN lineupEntries le ON le.submissionID=ls.id
    LEFT JOIN bowlers b ON b.bowlerID=le.bowlerID
    WHERE ls.seasonID=@s AND ls.week=@w ORDER BY ls.teamID, le.position`)).recordset;
  const lineupOf = new Map();
  for (const r of subs) { if (!lineupOf.has(r.teamID)) lineupOf.set(r.teamID, []); lineupOf.get(r.teamID).push(r.bowlerName || r.newBowlerName); }
  await pool.close();

  const rows = [];
  const unmatched = [], noAvg = [], seen = new Map();
  for (const t of TONIGHT) {
    let roster = (rosterOf[t.lp] || []).slice();
    for (const d of (DROP[t.lp] || [])) roster = roster.filter(r => key(r.name) !== key(d));
    for (const a of (ADD[t.lp] || [])) if (!roster.some(r => key(r.name) === key(a.name))) roster.push(a);

    const ln = lineupOf.get(t.teamID) || [];
    const rank = r => { const i = ln.findIndex(n => norm(n) === key(r.name)); return i === -1 ? 999 : i; };
    roster.sort((a, b) => rank(a) - rank(b));

    roster.forEach((r, i) => {
      const k = key(r.name);
      if (!dbNames.has(k)) unmatched.push(`${t.lp}: ${r.name}`);
      const avg = avgByName.get(k);
      if (avg == null) noAvg.push(`${t.lp}: ${r.name}`);
      const dk = k;
      if (!seen.has(dk)) seen.set(dk, []); seen.get(dk).push(t.lp);
      const row = Object.fromEntries(COLUMNS.map(c => [c, '']));
      row['Bowler Name'] = r.name;
      row['Email'] = r.email;
      row['Team Name'] = t.lp;
      row['Team ID'] = '';                 // blank -> importer matches on Team Name
      row['Lineup Position'] = String(i + 1);
      row['Entering Average'] = avg != null ? String(avg) : '';
      rows.push(row);
    });
  }

  const esc = v => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const toCsv = rs => [COLUMNS.join(','), ...rs.map(r => COLUMNS.map(c => esc(r[c])).join(','))].join('\n') + '\n';

  const testRows = rows.filter(r => r['Team Name'] === 'Guttermouths' && r['Bowler Name'] === 'Julie Doring');
  writeFileSync(`${OUT}/lp-B-0803-TEST.csv`, toCsv(testRows));
  writeFileSync(`${OUT}/lp-B-0803-FULL.csv`, toCsv(rows));

  console.log(`TEST csv: ${testRows.length} row  -> ${OUT}/lp-B-0803-TEST.csv`);
  console.log(`FULL csv: ${rows.length} rows -> ${OUT}/lp-B-0803-FULL.csv`);
  const byTeam = {};
  for (const r of rows) byTeam[r['Team Name']] = (byTeam[r['Team Name']] || 0) + 1;
  console.log('\nseats per team:');
  for (const t of TONIGHT) {
    const top4 = rows.filter(r => r['Team Name'] === t.lp).slice(0, 4)
      .reduce((n, r) => n + (parseInt(r['Entering Average'], 10) || 0), 0);
    console.log(`  ${t.lp.padEnd(20)} ${String(byTeam[t.lp] || 0).padStart(2)} seats   top4=${top4}${lineupOf.has(t.teamID) ? '' : '   (no lineup - roster order unchanged)'}`);
  }
  console.log(`\nTOTAL ROWS: ${rows.length}`);
  if (unmatched.length) console.log(`\n!! not matched to our bowlers table (${unmatched.length}):\n   ` + unmatched.join('\n   '));
  if (noAvg.length) console.log(`\n!! blank Entering Average (${noAvg.length}):\n   ` + noAvg.join('\n   '));
  const dupes = [...seen.entries()].filter(([, ts]) => ts.length > 1);
  if (dupes.length) console.log(`\n!! seated on two teams:\n   ` + dupes.map(([n, ts]) => `${n} -> ${ts.join(' + ')}`).join('\n   '));
  else console.log('\nno cross-team double seating');
};

main().catch(e => { console.error('FAILED:', e); process.exit(1); });
