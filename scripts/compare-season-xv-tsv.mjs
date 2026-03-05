import sql from 'mssql';
import { readFileSync } from 'fs';

const env = readFileSync('.env.local', 'utf8');
for (const line of env.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim();
}

// --- Parse TSV ---
const tsvText = readFileSync('docs/Splitzkrieg Raw Data - Copy of Season XV.tsv', 'utf8');
const tsvLines = tsvText.split('\n');
const tsvHeader = tsvLines[0].split('\t');
const tsvData = tsvLines.slice(1).filter(l => l.trim());

const tsvRoster = {};   // "week-team" => [bowlerNames]
const tsvPenalties = {}; // "week-team" => count
const tsvTeams = new Set();

for (const line of tsvData) {
  const fields = line.split('\t');
  const week = parseInt(fields[0]);
  const team = fields[1]?.trim();
  const bowler = fields[2]?.trim();
  if (isNaN(week) || !team) continue;
  tsvTeams.add(team);
  const key = `${week}-${team}`;

  if (bowler === 'PENALTY' || !bowler) {
    tsvPenalties[key] = (tsvPenalties[key] || 0) + 1;
  } else {
    if (!tsvRoster[key]) tsvRoster[key] = [];
    tsvRoster[key].push(bowler);
  }
}

// --- Also parse big CSV for Season XV to compare team names ---
const csvText = readFileSync('docs/Splitzkrieg Database (Apr 2007 - Now) - Data Import (1).csv', 'utf8');
// Simple CSV parser
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
const csvRows = parseCSV(csvText).slice(1);
const csvTeamsXV = new Set();
for (const row of csvRows) {
  if (row.length >= 15 && row[14] === 'XV') csvTeamsXV.add(row[1]?.trim());
}

console.log('=== TEAM NAME COMPARISON ===');
console.log(`\nTSV teams (${tsvTeams.size}):`);
for (const t of [...tsvTeams].sort()) console.log(`  ${t}`);
console.log(`\nBig CSV teams for "XV" (${csvTeamsXV.size}):`);
for (const t of [...csvTeamsXV].sort()) console.log(`  ${t}`);

// Check overlap
const tsvOnly = [...tsvTeams].filter(t => !csvTeamsXV.has(t));
const csvOnly = [...csvTeamsXV].filter(t => !tsvTeams.has(t));
console.log(`\nIn TSV only: ${tsvOnly.join(', ') || '(none)'}`);
console.log(`In big CSV only: ${csvOnly.join(', ') || '(none)'}`);

// --- Query DB ---
const pool = await new sql.ConnectionPool({
  server: process.env.AZURE_SQL_SERVER,
  database: process.env.AZURE_SQL_DATABASE,
  user: process.env.AZURE_SQL_USER,
  password: process.env.AZURE_SQL_PASSWORD,
  options: { encrypt: true, trustServerCertificate: false, connectTimeout: 120000, requestTimeout: 30000 },
}).connect();

// Check Stinky Cheese in DB
const stinky = await pool.request().query(`
  SELECT t.teamID, t.teamName, t.slug,
    (SELECT COUNT(*) FROM scores s WHERE s.teamID = t.teamID) as scoreCount
  FROM teams t WHERE t.teamName LIKE '%Stinky%' OR t.teamName LIKE '%Cheese%'
`);
console.log('\n=== STINKY CHEESE IN DB ===');
if (stinky.recordset.length === 0) {
  console.log('NOT FOUND in teams table!');
  // Search by bowler - who bowled for Stinky Cheese in the TSV?
  const stinkyBowlers = new Set();
  for (const line of tsvData) {
    const fields = line.split('\t');
    if (fields[1]?.trim() === 'Stinky Cheese') {
      const b = fields[2]?.trim();
      if (b && b !== 'PENALTY') stinkyBowlers.add(b);
    }
  }
  console.log(`TSV bowlers for Stinky Cheese: ${[...stinkyBowlers].join(', ')}`);
} else {
  for (const r of stinky.recordset) {
    console.log(`  ${r.teamName} (ID: ${r.teamID}, scores: ${r.scoreCount}, seasons: ${r.seasons})`);
  }
}

// Check Bull City Rollers
const bull = await pool.request().query(`
  SELECT t.teamID, t.teamName FROM teams t WHERE t.teamName LIKE '%Bull%' OR t.teamName LIKE '%Roller%'
`);
console.log('\n=== BULL CITY ROLLERS IN DB ===');
if (bull.recordset.length === 0) console.log('NOT FOUND');
else for (const r of bull.recordset) console.log(`  ${r.teamName} (ID: ${r.teamID})`);

// Check Blame It on the Lane
const blame = await pool.request().query(`
  SELECT t.teamID, t.teamName FROM teams t WHERE t.teamName LIKE '%Blame%' OR t.teamName LIKE '%Lane%'
`);
console.log('\n=== BLAME IT ON THE LANE IN DB ===');
if (blame.recordset.length === 0) console.log('NOT FOUND');
else for (const r of blame.recordset) console.log(`  ${r.teamName} (ID: ${r.teamID})`);

// Get DB teams for season 15
const dbResult = await pool.request().query(`
  SELECT DISTINCT t.teamName, t.teamID
  FROM scores s JOIN teams t ON s.teamID = t.teamID
  WHERE s.seasonID = 15
  ORDER BY t.teamName
`);
console.log(`\nDB teams for seasonID=15 (${dbResult.recordset.length}):`);
for (const r of dbResult.recordset) console.log(`  ${r.teamName} (ID: ${r.teamID})`);

// Now compare TSV vs DB bowler-by-bowler for season 15
const dbScores = await pool.request().query(`
  SELECT s.week, t.teamName, b.bowlerName, s.isPenalty
  FROM scores s
  JOIN bowlers b ON s.bowlerID = b.bowlerID
  JOIN teams t ON s.teamID = t.teamID
  WHERE s.seasonID = 15
  ORDER BY s.week, t.teamName, b.bowlerName
`);

const dbRoster = {};
const dbPen = {};
for (const r of dbScores.recordset) {
  const key = `${r.week}-${r.teamName}`;
  if (r.isPenalty) { dbPen[key] = (dbPen[key] || 0) + 1; }
  else { if (!dbRoster[key]) dbRoster[key] = []; dbRoster[key].push(r.bowlerName); }
}

// Try matching TSV team -> DB team by bowler overlap
console.log('\n=== TSV→DB TEAM MATCHING (by bowler overlap) ===');
const tsvToDb = {};
for (const tsvTeam of [...tsvTeams].sort()) {
  // Collect all bowlers for this TSV team across all weeks
  const tsvBowlers = new Set();
  for (const [key, bowlers] of Object.entries(tsvRoster)) {
    if (key.split('-').slice(1).join('-') === tsvTeam) {
      for (const b of bowlers) tsvBowlers.add(b);
    }
  }

  // Find best DB team match by bowler name overlap
  let bestMatch = null;
  let bestOverlap = 0;
  for (const dbTeam of dbResult.recordset) {
    const dbBowlers = new Set();
    for (const [key, bowlers] of Object.entries(dbRoster)) {
      if (key.split('-').slice(1).join('-') === dbTeam.teamName) {
        for (const b of bowlers) dbBowlers.add(b);
      }
    }
    // Count overlap (case-insensitive, fuzzy on spaces)
    let overlap = 0;
    for (const tb of tsvBowlers) {
      for (const db of dbBowlers) {
        if (tb.toLowerCase().trim() === db.toLowerCase().trim()) { overlap++; break; }
        // Try removing trailing spaces, "II" suffixes, etc
        if (tb.replace(/\s+II$/, '').trim().toLowerCase() === db.trim().toLowerCase()) { overlap++; break; }
      }
    }
    if (overlap > bestOverlap) { bestOverlap = overlap; bestMatch = dbTeam.teamName; }
  }
  const status = bestOverlap > 0 ? `→ ${bestMatch} (${bestOverlap} bowlers match)` : '→ NO MATCH';
  console.log(`  ${tsvTeam.padEnd(30)} ${status}`);
  if (bestMatch && bestOverlap >= 2) tsvToDb[tsvTeam] = bestMatch;
}

// Now do the actual comparison using matched teams
console.log('\n=== SEASON XV: TSV vs DB DISAGREEMENTS (using raw TSV) ===\n');

const allWeeks = new Set();
for (const key of [...Object.keys(tsvRoster), ...Object.keys(tsvPenalties)]) {
  allWeeks.add(parseInt(key.split('-')[0]));
}

let disagreements = 0;
let missingFromDb = 0;
let extraInDb = 0;

for (const week of [...allWeeks].sort((a, b) => a - b)) {
  const weekIssues = [];

  for (const tsvTeam of [...tsvTeams].sort()) {
    const dbTeam = tsvToDb[tsvTeam];
    if (!dbTeam) continue;

    const tsvKey = `${week}-${tsvTeam}`;
    const dbKey = `${week}-${dbTeam}`;

    const tsvB = tsvRoster[tsvKey] || [];
    const dbB = dbRoster[dbKey] || [];
    const tsvP = tsvPenalties[tsvKey] || 0;
    const dbP = dbPen[dbKey] || 0;

    const countsDiffer = tsvB.length !== dbB.length || tsvP !== dbP;

    const tsvSet = new Set(tsvB.map(n => n.toLowerCase().trim()));
    const dbSet = new Set(dbB.map(n => n.toLowerCase().trim()));
    const inTsvNotDb = tsvB.filter(n => !dbSet.has(n.toLowerCase().trim()));
    const inDbNotTsv = dbB.filter(n => !tsvSet.has(n.toLowerCase().trim()));

    if (countsDiffer || inTsvNotDb.length > 0 || inDbNotTsv.length > 0) {
      let issue = `  ${(tsvTeam + (dbTeam !== tsvTeam ? ` [DB: ${dbTeam}]` : '')).padEnd(50)}`;
      issue += `TSV: ${tsvB.length}+${tsvP}pen  DB: ${dbB.length}+${dbP}pen`;
      if (inTsvNotDb.length) { issue += `\n    TSV only: ${inTsvNotDb.join(', ')}`; missingFromDb += inTsvNotDb.length; }
      if (inDbNotTsv.length) { issue += `\n    DB only:  ${inDbNotTsv.join(', ')}`; extraInDb += inDbNotTsv.length; }
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

console.log(`Total disagreements: ${disagreements}`);
console.log(`Bowlers in TSV not in DB: ${missingFromDb}`);
console.log(`Bowlers in DB not in TSV: ${extraInDb}`);

// Unmatched TSV teams
const unmatched = [...tsvTeams].filter(t => !tsvToDb[t]);
if (unmatched.length) {
  console.log(`\nUnmatched TSV teams: ${unmatched.join(', ')}`);
  for (const t of unmatched) {
    const bowlers = new Set();
    let weeks = new Set();
    for (const [key, bs] of Object.entries(tsvRoster)) {
      if (key.split('-').slice(1).join('-') === t) {
        weeks.add(parseInt(key.split('-')[0]));
        for (const b of bs) bowlers.add(b);
      }
    }
    console.log(`  ${t}: weeks ${[...weeks].sort((a,b)=>a-b).join(',')}, bowlers: ${[...bowlers].join(', ')}`);
  }
}

await pool.close();
