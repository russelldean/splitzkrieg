import sql from 'mssql';
import { readFileSync } from 'fs';

const env = readFileSync('.env.local', 'utf8');
for (const line of env.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim();
}

// Simple CSV parser that handles quoted fields
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

// --- Parse CSV for Season XV ---
const csvText = readFileSync('docs/Splitzkrieg Database (Apr 2007 - Now) - Data Import (1).csv', 'utf8');
const allRows = parseCSV(csvText);
const dataRows = allRows.slice(1);

// Build CSV roster: { "week-team" => [bowlerNames] } and track PENALTY rows
const csvRoster = {};   // key => array of real bowler names
const csvPenalties = {}; // key => count of PENALTY rows

for (const row of dataRows) {
  if (row.length < 15) continue;
  const [weekStr, team, bowler, , , , , , , , , , , , season] = row;
  if (season !== 'XV') continue;
  const week = parseInt(weekStr);
  if (isNaN(week) || !team) continue;
  const key = `${week}-${team}`;

  if (bowler === 'PENALTY') {
    csvPenalties[key] = (csvPenalties[key] || 0) + 1;
  } else if (bowler && !bowler.includes('ZUB')) {
    if (!csvRoster[key]) csvRoster[key] = [];
    csvRoster[key].push(bowler);
  }
}

// --- Query DB for Season XV ---
const pool = await new sql.ConnectionPool({
  server: process.env.AZURE_SQL_SERVER,
  database: process.env.AZURE_SQL_DATABASE,
  user: process.env.AZURE_SQL_USER,
  password: process.env.AZURE_SQL_PASSWORD,
  options: { encrypt: true, trustServerCertificate: false, connectTimeout: 120000, requestTimeout: 30000 },
}).connect();

const dbResult = await pool.request().query(`
  SELECT s.week, t.teamName, b.bowlerName, s.isPenalty
  FROM scores s
  JOIN bowlers b ON s.bowlerID = b.bowlerID
  JOIN teams t ON s.teamID = t.teamID
  WHERE s.seasonID = 15
  ORDER BY s.week, t.teamName, b.bowlerName
`);

// Build DB roster
const dbRoster = {};    // key => array of real bowler names
const dbPenalties = {}; // key => count of penalty rows

for (const r of dbResult.recordset) {
  const key = `${r.week}-${r.teamName}`;
  if (r.isPenalty) {
    dbPenalties[key] = (dbPenalties[key] || 0) + 1;
  } else {
    if (!dbRoster[key]) dbRoster[key] = [];
    dbRoster[key].push(r.bowlerName);
  }
}

// --- Also build a CSV team name -> DB team name mapping ---
// Get all DB team names for season 15
const dbTeams = new Set();
for (const r of dbResult.recordset) dbTeams.add(r.teamName);
const csvTeams = new Set();
for (const key of Object.keys(csvRoster)) csvTeams.add(key.split('-').slice(1).join('-'));
for (const key of Object.keys(csvPenalties)) csvTeams.add(key.split('-').slice(1).join('-'));

console.log('=== TEAM NAME MAPPING ===');
console.log('CSV Teams:', [...csvTeams].sort().join(', '));
console.log('DB Teams: ', [...dbTeams].sort().join(', '));

// Try to match CSV teams to DB teams
const renames = {
  'gutter mouths': 'guttermouths',
  'guttersnipes': 'the guttersnipes',
  'village covidiots': 'village idiots',
  'pindemix': 'pindemics',
  'werewolf splitzers': 'thoughts and spares',
  'mom ballerz': 'alley oops',
};

const csvToDb = {};
for (const csvName of csvTeams) {
  // Exact match
  if (dbTeams.has(csvName)) { csvToDb[csvName] = csvName; continue; }
  // Case-insensitive match
  for (const dbName of dbTeams) {
    if (dbName.toLowerCase() === csvName.toLowerCase()) { csvToDb[csvName] = dbName; break; }
  }
  if (csvToDb[csvName]) continue;
  // Known renames
  const renamed = renames[csvName.toLowerCase()];
  if (renamed) {
    for (const dbName of dbTeams) {
      if (dbName.toLowerCase() === renamed) { csvToDb[csvName] = dbName; break; }
    }
  }
}

const unmapped = [...csvTeams].filter(t => !csvToDb[t]);
if (unmapped.length) {
  console.log('\nUnmapped CSV teams:', unmapped);
}

// --- Compare side by side ---
console.log('\n=== SEASON XV: CSV vs DB DISAGREEMENTS ===');
console.log('(Only showing team-weeks where bowler count or roster differs)\n');

let disagreements = 0;
const allWeeks = new Set();
for (const key of [...Object.keys(csvRoster), ...Object.keys(csvPenalties)]) {
  allWeeks.add(parseInt(key.split('-')[0]));
}

for (const week of [...allWeeks].sort((a, b) => a - b)) {
  const weekIssues = [];

  for (const csvTeam of [...csvTeams].sort()) {
    const dbTeam = csvToDb[csvTeam];
    if (!dbTeam) continue; // skip unmapped

    const csvKey = `${week}-${csvTeam}`;
    const dbKey = `${week}-${dbTeam}`;

    const csvBowlers = csvRoster[csvKey] || [];
    const dbBowlers = dbRoster[dbKey] || [];
    const csvPen = csvPenalties[csvKey] || 0;
    const dbPen = dbPenalties[dbKey] || 0;

    const csvTotal = csvBowlers.length + csvPen;
    const dbTotal = dbBowlers.length + dbPen;

    // Check if they disagree
    const countsDiffer = csvBowlers.length !== dbBowlers.length || csvPen !== dbPen;

    // Check roster mismatch (name-level)
    const csvSet = new Set(csvBowlers.map(n => n.toLowerCase()));
    const dbSet = new Set(dbBowlers.map(n => n.toLowerCase()));
    const inCsvNotDb = csvBowlers.filter(n => !dbSet.has(n.toLowerCase()));
    const inDbNotCsv = dbBowlers.filter(n => !csvSet.has(n.toLowerCase()));
    const rosterDiffers = inCsvNotDb.length > 0 || inDbNotCsv.length > 0;

    if (countsDiffer || rosterDiffers) {
      let issue = `  ${(dbTeam || csvTeam).padEnd(28)}`;
      issue += `CSV: ${csvBowlers.length} bowlers + ${csvPen} pen = ${csvTotal}  |  `;
      issue += `DB: ${dbBowlers.length} bowlers + ${dbPen} pen = ${dbTotal}`;
      if (inCsvNotDb.length) issue += `\n    CSV only: ${inCsvNotDb.join(', ')}`;
      if (inDbNotCsv.length) issue += `\n    DB only:  ${inDbNotCsv.join(', ')}`;
      weekIssues.push(issue);
      disagreements++;
    }
  }

  if (weekIssues.length) {
    console.log(`--- Week ${week} ---`);
    for (const issue of weekIssues) console.log(issue);
    console.log('');
  }
}

console.log(`\nTotal disagreements: ${disagreements}`);

// --- Summary: which team-weeks need penalty inserts ---
console.log('\n=== PENALTY ROWS NEEDED (CSV says PENALTY, DB has <4 bowlers, no isPenalty row) ===\n');

let needed = 0;
for (const week of [...allWeeks].sort((a, b) => a - b)) {
  for (const csvTeam of [...csvTeams].sort()) {
    const dbTeam = csvToDb[csvTeam];
    if (!dbTeam) continue;

    const csvKey = `${week}-${csvTeam}`;
    const dbKey = `${week}-${dbTeam}`;

    const csvPen = csvPenalties[csvKey] || 0;
    const dbPen = dbPenalties[dbKey] || 0;
    const dbBowlers = (dbRoster[dbKey] || []).length;

    if (csvPen > dbPen) {
      const toAdd = csvPen - dbPen;
      console.log(`  Wk ${String(week).padStart(2)}  ${(dbTeam).padEnd(28)} CSV: ${csvPen} pen, DB: ${dbPen} pen (${dbBowlers} bowlers) → need ${toAdd}`);
      needed += toAdd;
    }
  }
}
console.log(`\nTotal penalty rows to insert: ${needed}`);

await pool.close();
