import sql from 'mssql';
import { readFileSync } from 'fs';

const env = readFileSync('.env.local', 'utf8');
for (const line of env.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim();
}

const romanToID = {I:1,II:2,III:3,IV:4,V:5,VI:6,VII:7,VIII:8,IX:9,X:10,
  XI:11,XII:12,XIII:13,XIV:14,XV:15,XVI:16,XVII:17,XVIII:18,XIX:19,XX:20,
  XXI:21,XXII:22,XXIII:23,XXIV:24,XXV:25,XXVI:26,XXVII:27,XXVIII:28,XXIX:29,
  XXX:30,XXXI:31,XXXII:32,XXXIII:33,XXXIV:34,XXXV:35};

function parseCSV(text) {
  const lines = text.split('\n');
  const results = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const fields = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') { inQuotes = !inQuotes; }
      else if (line[i] === ',' && !inQuotes) { fields.push(current.trim()); current = ''; }
      else { current += line[i]; }
    }
    fields.push(current.trim());
    results.push(fields);
  }
  return results;
}

// --- Parse big CSV: collect bowlers per (season, team) ---
const csvText = readFileSync('docs/Splitzkrieg Database (Apr 2007 - Now) - Data Import (1).csv', 'utf8');
const csvRows = parseCSV(csvText).slice(1);

// seasonTeamBowlers: { "seasonID-csvTeam" => Set of bowler names }
const seasonTeamBowlers = {};

for (const row of csvRows) {
  if (row.length < 15) continue;
  const [weekStr, team, bowler, , , , , , , , , , , , season] = row;
  const seasonID = romanToID[season];
  if (!seasonID || !team) continue;
  if (bowler && bowler !== 'PENALTY' && !bowler.includes('ZUB')) {
    const key = `${seasonID}-${team}`;
    if (!seasonTeamBowlers[key]) seasonTeamBowlers[key] = new Set();
    seasonTeamBowlers[key].add(bowler);
  }
}

// --- Override Season XV with TSV data ---
const tsvText = readFileSync('docs/Splitzkrieg Raw Data - Copy of Season XV.tsv', 'utf8');
const tsvLines = tsvText.split('\n').slice(1).filter(l => l.trim());

// Remove CSV season XV entries
for (const key of Object.keys(seasonTeamBowlers)) {
  if (key.startsWith('15-')) delete seasonTeamBowlers[key];
}

for (const line of tsvLines) {
  const fields = line.split('\t');
  const team = fields[1]?.trim();
  const bowler = fields[2]?.trim();
  if (!team) continue;
  if (bowler && bowler !== 'PENALTY') {
    const key = `15-${team}`;
    if (!seasonTeamBowlers[key]) seasonTeamBowlers[key] = new Set();
    seasonTeamBowlers[key].add(bowler);
  }
}

// --- Connect to DB ---
const pool = await new sql.ConnectionPool({
  server: process.env.AZURE_SQL_SERVER,
  database: process.env.AZURE_SQL_DATABASE,
  user: process.env.AZURE_SQL_USER,
  password: process.env.AZURE_SQL_PASSWORD,
  options: { encrypt: true, trustServerCertificate: false, connectTimeout: 120000, requestTimeout: 30000 },
}).connect();

// Get all DB bowlers per (season, team)
const dbScores = await pool.request().query(`
  SELECT s.seasonID, s.teamID, t.teamName, b.bowlerName
  FROM scores s
  JOIN bowlers b ON s.bowlerID = b.bowlerID
  JOIN teams t ON s.teamID = t.teamID
  WHERE s.isPenalty = 0
`);

// dbTeamBowlers: { "seasonID-teamID" => Set of bowler names }
const dbTeamBowlers = {};
const dbTeamNames = {}; // teamID -> canonical name
for (const r of dbScores.recordset) {
  const key = `${r.seasonID}-${r.teamID}`;
  if (!dbTeamBowlers[key]) dbTeamBowlers[key] = new Set();
  dbTeamBowlers[key].add(r.bowlerName);
  dbTeamNames[r.teamID] = r.teamName;
}

// Get all teams
const allTeams = await pool.request().query('SELECT teamID, teamName FROM teams ORDER BY teamID');
const teamsByID = {};
for (const t of allTeams.recordset) teamsByID[t.teamID] = t.teamName;

// Get seasons
const seasons = await pool.request().query('SELECT seasonID, displayName FROM seasons ORDER BY seasonID');
const seasonNames = {};
for (const s of seasons.recordset) seasonNames[s.seasonID] = s.displayName;

// --- Match each CSV (season, team) to a DB teamID via bowler overlap ---
// Group by season
const seasonTeams = {}; // seasonID -> [{csvTeam, bowlers}]
for (const [key, bowlers] of Object.entries(seasonTeamBowlers)) {
  const dashIdx = key.indexOf('-');
  const seasonID = parseInt(key.substring(0, dashIdx));
  const csvTeam = key.substring(dashIdx + 1);
  if (!seasonTeams[seasonID]) seasonTeams[seasonID] = [];
  seasonTeams[seasonID].push({ csvTeam, bowlers });
}

const results = []; // { seasonID, csvTeam, teamID, dbTeam, overlap, totalCsvBowlers }
const unmatched = [];

for (const [seasonIDStr, teams] of Object.entries(seasonTeams).sort((a, b) => a[0] - b[0])) {
  const seasonID = parseInt(seasonIDStr);

  for (const { csvTeam, bowlers: csvBowlers } of teams) {
    let bestTeamID = null;
    let bestOverlap = 0;

    // Check all DB teams that played in this season
    for (const [dbKey, dbBowlers] of Object.entries(dbTeamBowlers)) {
      if (!dbKey.startsWith(`${seasonID}-`)) continue;
      const teamID = parseInt(dbKey.split('-')[1]);

      let overlap = 0;
      for (const cb of csvBowlers) {
        for (const db of dbBowlers) {
          // Fuzzy match: normalize whitespace, case, common variations
          const cn = cb.toLowerCase().trim().replace(/\s+/g, ' ');
          const dn = db.toLowerCase().trim().replace(/\s+/g, ' ');
          if (cn === dn) { overlap++; break; }
          // Handle "II" suffix, trailing spaces
          if (cn.replace(/\s+ii$/, '').trim() === dn.replace(/\s+ii$/, '').trim()) { overlap++; break; }
          // Handle Jenn/Jennifer, etc
          if (cn.replace(/^jenn /, 'jennifer ') === dn.replace(/^jenn /, 'jennifer ')) { overlap++; break; }
        }
      }

      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        bestTeamID = teamID;
      }
    }

    if (bestTeamID && bestOverlap >= 1) {
      results.push({
        seasonID,
        csvTeam,
        teamID: bestTeamID,
        dbTeam: teamsByID[bestTeamID],
        overlap: bestOverlap,
        totalCsvBowlers: csvBowlers.size,
      });
    } else {
      unmatched.push({ seasonID, csvTeam, bowlerCount: csvBowlers.size, bowlers: [...csvBowlers].slice(0, 5) });
    }
  }
}

// --- Check for conflicts: multiple CSV teams mapping to the same DB team in same season ---
const conflictCheck = {};
for (const r of results) {
  const key = `${r.seasonID}-${r.teamID}`;
  if (!conflictCheck[key]) conflictCheck[key] = [];
  conflictCheck[key].push(r);
}

console.log('=== CONFLICTS (multiple CSV teams → same DB team in same season) ===\n');
let conflictCount = 0;
for (const [key, entries] of Object.entries(conflictCheck)) {
  if (entries.length > 1) {
    conflictCount++;
    console.log(`  ${seasonNames[entries[0].seasonID]} → ${entries[0].dbTeam} (ID ${entries[0].teamID}):`);
    for (const e of entries) {
      console.log(`    "${e.csvTeam}" (${e.overlap}/${e.totalCsvBowlers} bowlers match)`);
    }
  }
}
if (!conflictCount) console.log('  None!\n');

// --- Display: franchise history (DB teamID → name over time) ---
console.log('\n=== FRANCHISE NAME HISTORY ===\n');

// Group results by teamID
const franchiseHistory = {}; // teamID -> [{seasonID, csvTeam}]
for (const r of results) {
  if (!franchiseHistory[r.teamID]) franchiseHistory[r.teamID] = [];
  franchiseHistory[r.teamID].push({ seasonID: r.seasonID, csvTeam: r.csvTeam, overlap: r.overlap, total: r.totalCsvBowlers });
}

for (const teamID of Object.keys(franchiseHistory).sort((a, b) => a - b)) {
  const canonical = teamsByID[teamID];
  const history = franchiseHistory[teamID].sort((a, b) => a.seasonID - b.seasonID);

  // Check if name ever changed
  const names = [...new Set(history.map(h => h.csvTeam))];
  const hasChanges = names.length > 1 || (names.length === 1 && names[0] !== canonical);

  // Show all franchises, highlight name changes
  const tag = hasChanges ? ' ***' : '';
  console.log(`${canonical} (ID ${teamID})${tag}`);

  let prevName = null;
  for (const h of history) {
    const changed = prevName && prevName !== h.csvTeam ? ' ← CHANGED' : '';
    const mismatch = h.csvTeam !== canonical && !changed ? ' (≠ canonical)' : '';
    const matchQuality = h.overlap < 2 ? ` [weak: ${h.overlap}/${h.total}]` : '';
    console.log(`  ${(seasonNames[h.seasonID] || `S${h.seasonID}`).padEnd(14)} ${h.csvTeam}${changed}${mismatch}${matchQuality}`);
    prevName = h.csvTeam;
  }
  console.log('');
}

// --- Anomalies: names that appear then disappear then reappear ---
console.log('=== ANOMALIES: NAMES THAT APPEAR/DISAPPEAR SUSPICIOUSLY ===\n');
for (const teamID of Object.keys(franchiseHistory).sort((a, b) => a - b)) {
  const history = franchiseHistory[teamID].sort((a, b) => a.seasonID - b.seasonID);
  for (let i = 1; i < history.length - 1; i++) {
    if (history[i].csvTeam !== history[i - 1].csvTeam && history[i].csvTeam !== history[i + 1].csvTeam) {
      console.log(`  ${teamsByID[teamID]}: "${history[i].csvTeam}" only appears in ${seasonNames[history[i].seasonID]} (between "${history[i-1].csvTeam}" and "${history[i+1].csvTeam}")`);
    }
  }
}

// --- Unmatched ---
if (unmatched.length) {
  console.log('\n=== UNMATCHED CSV TEAMS (no DB match) ===\n');
  for (const u of unmatched.sort((a, b) => a.seasonID - b.seasonID)) {
    console.log(`  ${(seasonNames[u.seasonID] || `S${u.seasonID}`).padEnd(14)} "${u.csvTeam}" (${u.bowlerCount} bowlers: ${u.bowlers.join(', ')}...)`);
  }
}

// Summary
console.log(`\n=== SUMMARY ===`);
console.log(`  Total season-team pairs: ${results.length}`);
console.log(`  Unique franchises: ${Object.keys(franchiseHistory).length}`);
console.log(`  Conflicts: ${conflictCount}`);
console.log(`  Unmatched: ${unmatched.length}`);
console.log(`  Weak matches (overlap < 2): ${results.filter(r => r.overlap < 2).length}`);

await pool.close();
