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

// --- Entries to exclude ---
const excludeNames = new Set([
  'Team 18',        // placeholder, became Over the Shoulder Bowler Holders
]);

// Filter function: remove ZUB entries and excluded names
function shouldExclude(teamName) {
  if (!teamName) return true;
  if (teamName.includes('ZUB')) return true;
  if (excludeNames.has(teamName)) return true;
  return false;
}

// --- Parse big CSV ---
const csvText = readFileSync('docs/Splitzkrieg Database (Apr 2007 - Now) - Data Import (1).csv', 'utf8');
const csvRows = parseCSV(csvText).slice(1);

// seasonTeamBowlers: { "seasonID-csvTeam" => Set of bowler names }
const seasonTeamBowlers = {};

for (const row of csvRows) {
  if (row.length < 15) continue;
  const [weekStr, team, bowler, , , , , , , , , , , , season] = row;
  const seasonID = romanToID[season];
  if (!seasonID || !team) continue;
  if (shouldExclude(team)) continue;
  if (bowler && bowler !== 'PENALTY' && !bowler.includes('ZUB')) {
    const key = `${seasonID}-${team}`;
    if (!seasonTeamBowlers[key]) seasonTeamBowlers[key] = new Set();
    seasonTeamBowlers[key].add(bowler);
  }
}

// --- Override Season XV with TSV ---
const tsvText = readFileSync('docs/Splitzkrieg Raw Data - Copy of Season XV.tsv', 'utf8');
const tsvLines = tsvText.split('\n').slice(1).filter(l => l.trim());

for (const key of Object.keys(seasonTeamBowlers)) {
  if (key.startsWith('15-')) delete seasonTeamBowlers[key];
}

for (const line of tsvLines) {
  const fields = line.split('\t');
  const team = fields[1]?.trim();
  const bowler = fields[2]?.trim();
  if (!team || shouldExclude(team)) continue;
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

// Get DB bowlers per (season, team)
const dbScores = await pool.request().query(`
  SELECT s.seasonID, s.teamID, b.bowlerName
  FROM scores s
  JOIN bowlers b ON s.bowlerID = b.bowlerID
  WHERE s.isPenalty = 0
`);

const dbTeamBowlers = {};
for (const r of dbScores.recordset) {
  const key = `${r.seasonID}-${r.teamID}`;
  if (!dbTeamBowlers[key]) dbTeamBowlers[key] = new Set();
  dbTeamBowlers[key].add(r.bowlerName);
}

// Get team and season info
const allTeams = await pool.request().query('SELECT teamID, teamName FROM teams ORDER BY teamID');
const teamsByID = {};
for (const t of allTeams.recordset) teamsByID[t.teamID] = t.teamName;

const seasons = await pool.request().query('SELECT seasonID, displayName FROM seasons ORDER BY seasonID');
const seasonNames = {};
for (const s of seasons.recordset) seasonNames[s.seasonID] = s.displayName;

// --- Match CSV teams to DB teamIDs via bowler overlap ---
const rawMatches = []; // { seasonID, csvTeam, teamID, overlap, totalBowlers }

for (const [key, csvBowlers] of Object.entries(seasonTeamBowlers)) {
  const dashIdx = key.indexOf('-');
  const seasonID = parseInt(key.substring(0, dashIdx));
  const csvTeam = key.substring(dashIdx + 1);

  let bestTeamID = null;
  let bestOverlap = 0;

  for (const [dbKey, dbBowlers] of Object.entries(dbTeamBowlers)) {
    if (!dbKey.startsWith(`${seasonID}-`)) continue;
    const teamID = parseInt(dbKey.split('-')[1]);

    let overlap = 0;
    for (const cb of csvBowlers) {
      for (const db of dbBowlers) {
        const cn = cb.toLowerCase().trim().replace(/\s+/g, ' ');
        const dn = db.toLowerCase().trim().replace(/\s+/g, ' ');
        if (cn === dn) { overlap++; break; }
        if (cn.replace(/\s+ii$/, '').trim() === dn.replace(/\s+ii$/, '').trim()) { overlap++; break; }
        if (cn.replace(/^jenn /, 'jennifer ') === dn.replace(/^jenn /, 'jennifer ')) { overlap++; break; }
      }
    }

    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      bestTeamID = teamID;
    }
  }

  if (bestTeamID && bestOverlap >= 1) {
    rawMatches.push({ seasonID, csvTeam, teamID: bestTeamID, overlap: bestOverlap, totalBowlers: csvBowlers.size });
  }
}

// --- Deduplicate: when multiple CSV names map to same (season, teamID), keep the one with more bowlers ---
// Preferred names for known conflicts (keep these, drop the other)
const preferredNames = {
  'Pin-Ups': true,        // over "Pin Ups", "Pin-ups", "The Pin-Ups"
  'Smokeabowl Fernet': true,  // over "Smokeable Fernet"
  'Gutter Mouths': true,  // historical name, over "Guttermouths" (until they actually changed)
  'Spare Club for Men': true,  // over "Spare Club For Men"
  'Valley of the Balls': true, // over "Valley Of The Balls"
  'The Boom Kings': true,      // over "The Boomkings"
  'Alley Oops': true,         // over "Alley-Oops"
};

// Normalize typos/inconsistencies (not real name changes)
const nameNormalizations = {
  'Pin Ups': 'Pin-Ups',
  'Pin-ups': 'Pin-Ups',
  'The Pin-Ups': 'Pin-Ups',
  'Smoke-A-Bowl': 'Smoke-a-Bowl',
  'Alley-Oops': 'Alley Oops',
  'Pindemix': 'Pindemics',
  'Gutter Mouths': 'Guttermouths',  // always was one word, CSV had it wrong
};

// Group by season-teamID
const grouped = {};
for (const m of rawMatches) {
  const key = `${m.seasonID}-${m.teamID}`;
  if (!grouped[key]) grouped[key] = [];
  grouped[key].push(m);
}

const finalEntries = []; // { seasonID, teamID, teamName }

for (const [key, entries] of Object.entries(grouped)) {
  if (entries.length === 1) {
    finalEntries.push({ seasonID: entries[0].seasonID, teamID: entries[0].teamID, teamName: entries[0].csvTeam });
    continue;
  }

  // Multiple entries — pick preferred or highest overlap
  let winner = null;
  for (const e of entries) {
    if (preferredNames[e.csvTeam]) { winner = e; break; }
  }
  if (!winner) {
    // Pick the one with most bowlers (main roster, not stray sub)
    winner = entries.sort((a, b) => b.overlap - a.overlap)[0];
  }
  finalEntries.push({ seasonID: winner.seasonID, teamID: winner.teamID, teamName: winner.csvTeam });
}

// Apply name normalizations (typos/inconsistencies, not real changes)
for (const e of finalEntries) {
  if (nameNormalizations[e.teamName]) {
    e.teamName = nameNormalizations[e.teamName];
  }
}

// HOT FUN (ID 14): was Bowlonomics through XXXIV (seasonID 34), renamed to HOT FUN in XXXV (seasonID 35)
// CSV doesn't have XXXV data yet for this team, so add the entry manually
finalEntries.push({ seasonID: 35, teamID: 14, teamName: 'HOT FUN' });

// Sort by teamID then seasonID
finalEntries.sort((a, b) => a.teamID - b.teamID || a.seasonID - b.seasonID);

// --- Display final results ---
console.log('=== FINAL TEAM NAME HISTORY ===\n');

let curTeamID = null;
let prevName = null;
let entryCount = 0;

for (const e of finalEntries) {
  if (e.teamID !== curTeamID) {
    if (curTeamID !== null) console.log('');
    curTeamID = e.teamID;
    prevName = null;
    console.log(`${teamsByID[e.teamID]} (ID ${e.teamID}):`);
  }
  const changed = prevName && prevName !== e.teamName ? ' ← CHANGED' : '';
  const season = seasonNames[e.seasonID] || `S${e.seasonID}`;
  console.log(`  ${season.padEnd(14)} ${e.teamName}${changed}`);
  prevName = e.teamName;
  entryCount++;
}

console.log(`\n\n=== SUMMARY ===`);
console.log(`  Total entries: ${entryCount}`);
console.log(`  Franchises: ${new Set(finalEntries.map(e => e.teamID)).size}`);

// --- Create table and insert ---
if (process.argv.includes('--execute')) {
  console.log('\n--- CREATING TABLE AND INSERTING ---');

  // Drop if exists and recreate
  await pool.request().query(`
    IF OBJECT_ID('teamNameHistory', 'U') IS NOT NULL DROP TABLE teamNameHistory
  `);

  await pool.request().query(`
    CREATE TABLE teamNameHistory (
      id INT IDENTITY(1,1) PRIMARY KEY,
      seasonID INT NOT NULL,
      teamID INT NOT NULL,
      teamName NVARCHAR(100) NOT NULL,
      CONSTRAINT FK_tnh_season FOREIGN KEY (seasonID) REFERENCES seasons(seasonID),
      CONSTRAINT FK_tnh_team FOREIGN KEY (teamID) REFERENCES teams(teamID),
      CONSTRAINT UQ_tnh_season_team UNIQUE (seasonID, teamID)
    )
  `);
  console.log('Created teamNameHistory table');

  let count = 0;
  for (const e of finalEntries) {
    await pool.request()
      .input('seasonID', sql.Int, e.seasonID)
      .input('teamID', sql.Int, e.teamID)
      .input('teamName', sql.NVarChar(100), e.teamName)
      .query(`INSERT INTO teamNameHistory (seasonID, teamID, teamName) VALUES (@seasonID, @teamID, @teamName)`);
    count++;
  }
  console.log(`Inserted ${count} rows`);
} else {
  console.log('\nDRY RUN — pass --execute to create table and insert');
}

await pool.close();
