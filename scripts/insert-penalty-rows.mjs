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

// Parse CSV
const csvText = readFileSync('docs/Splitzkrieg Database (Apr 2007 - Now) - Data Import (1).csv', 'utf8');
const allRows = parseCSV(csvText);
const dataRows = allRows.slice(1);

// Bye weeks (entire league absent — not real penalties)
const byeWeeks = new Set(['13-9', '18-9', '25-6', '25-7', '25-8', '25-9']);

// Ghost team: Bowl'd Peanuts was placeholder in XXXI (31) and XXXII (32)
// These get routed to a new "Ghost Team" record, not real penalties
const ghostTeamSeasons = new Set([31, 32]);

const penaltyRows = [];
const ghostRows = [];
const teamBowlers = {};

for (const row of dataRows) {
  if (row.length < 15) continue;
  const [weekStr, team, bowler, , , , , , , , , , , , season] = row;
  const week = parseInt(weekStr);
  const seasonID = romanToID[season];
  if (!seasonID || !team || isNaN(week)) continue;

  // Ghost team: Bowl'd Peanuts in XXXI/XXXII — route separately
  if (team === "Bowl'd Peanuts" && ghostTeamSeasons.has(seasonID) && bowler === 'PENALTY') {
    ghostRows.push({ seasonID, week, season });
    continue;
  }

  if (bowler === 'PENALTY' && seasonID >= 15) {
    penaltyRows.push({ seasonID, week, csvTeam: team, season });
  } else if (!bowler && !byeWeeks.has(`${seasonID}-${week}`)) {
    penaltyRows.push({ seasonID, week, csvTeam: team, season, isForfeit: true });
  } else if (bowler && bowler !== 'PENALTY' && !bowler.includes('ZUB')) {
    const key = `${seasonID}-${week}-${team}`;
    if (!teamBowlers[key]) teamBowlers[key] = [];
    teamBowlers[key].push(bowler);
  }
}

console.log(`Found ${penaltyRows.length} real penalty/forfeit rows`);
console.log(`Found ${ghostRows.length} ghost team rows (Bowl'd Peanuts XXXI/XXXII)\n`);

const pool = await new sql.ConnectionPool({
  server: process.env.AZURE_SQL_SERVER,
  database: process.env.AZURE_SQL_DATABASE,
  user: process.env.AZURE_SQL_USER,
  password: process.env.AZURE_SQL_PASSWORD,
  options: { encrypt: true, trustServerCertificate: false, connectTimeout: 120000, requestTimeout: 30000 },
}).connect();

// --- Step 1: Create Ghost Team if needed ---
let ghostTeamID;
const ghostCheck = await pool.request().query("SELECT teamID FROM teams WHERE teamName = 'Ghost Team'");
if (ghostCheck.recordset.length > 0) {
  ghostTeamID = ghostCheck.recordset[0].teamID;
  console.log(`Ghost Team already exists (ID: ${ghostTeamID})`);
} else {
  if (process.argv.includes('--execute')) {
    const result = await pool.request().query("INSERT INTO teams (teamName, slug) OUTPUT INSERTED.teamID VALUES ('Ghost Team', 'ghost-team')");
    ghostTeamID = result.recordset[0].teamID;
    console.log(`Created Ghost Team (ID: ${ghostTeamID})`);
  } else {
    ghostTeamID = '??';
    console.log('Ghost Team will be created on --execute');
  }
}

// --- Step 2: Resolve real penalty rows ---
const existingScores = await pool.request().query(`
  SELECT s.seasonID, s.week, s.teamID, b.bowlerName
  FROM scores s JOIN bowlers b ON s.bowlerID = b.bowlerID
  WHERE s.isPenalty = 0
`);

const bowlerTeamLookup = {};
for (const r of existingScores.recordset) {
  bowlerTeamLookup[`${r.seasonID}-${r.week}-${r.bowlerName}`] = r.teamID;
}

// Build csvTeam -> teamID by matching teammates
const csvTeamToDBTeam = {};
for (const [key, bowlers] of Object.entries(teamBowlers)) {
  const parts = key.split('-');
  const seasonID = parseInt(parts[0]);
  const week = parseInt(parts[1]);
  const csvTeam = parts.slice(2).join('-');
  const mapKey = `${seasonID}-${csvTeam}`;
  if (csvTeamToDBTeam[mapKey]) continue;

  for (const bowler of bowlers) {
    const teamID = bowlerTeamLookup[`${seasonID}-${week}-${bowler}`];
    if (teamID) { csvTeamToDBTeam[mapKey] = teamID; break; }
  }
}

// Direct name fallback
const allTeams = await pool.request().query('SELECT teamID, teamName FROM teams');
const teamNameMap = {};
for (const t of allTeams.recordset) teamNameMap[t.teamName.toLowerCase()] = t.teamID;

// Known renames: CSV name -> DB canonical name
const renames = {
  'gutter mouths': 'guttermouths',
  'guttersnipes': 'the guttersnipes',
  'village covidiots': 'village idiots',
  'pindemix': 'pindemics',
  'werewolf splitzers': 'thoughts and spares',
  'mom ballerz': 'alley oops',
};

// Existing penalties in DB
const existingPenalties = await pool.request().query(`
  SELECT seasonID, week, teamID, COUNT(*) as cnt FROM scores WHERE isPenalty = 1
  GROUP BY seasonID, week, teamID
`);
const existingPenaltyMap = {};
for (const r of existingPenalties.recordset) {
  existingPenaltyMap[`${r.seasonID}-${r.week}-${r.teamID}`] = r.cnt;
}

// Resolve each penalty row
const resolved = [];
const unresolvedNames = new Set();

for (const p of penaltyRows) {
  let teamID = csvTeamToDBTeam[`${p.seasonID}-${p.csvTeam}`];
  if (!teamID) teamID = teamNameMap[p.csvTeam.toLowerCase()];
  if (!teamID) {
    const renamed = renames[p.csvTeam.toLowerCase()];
    if (renamed) teamID = teamNameMap[renamed];
  }
  if (!teamID) {
    unresolvedNames.add(`${p.season} Wk${p.week} "${p.csvTeam}"`);
    continue;
  }
  resolved.push({ seasonID: p.seasonID, week: p.week, teamID, csvTeam: p.csvTeam, season: p.season });
}

// Group by season-week-team
const grouped = {};
for (const r of resolved) {
  const key = `${r.seasonID}-${r.week}-${r.teamID}`;
  if (!grouped[key]) grouped[key] = { ...r, count: 0 };
  grouped[key].count++;
}

const toInsert = [];
let skippedCount = 0;

console.log('\n=== REAL PENALTY ROWS ===');
console.log('Season      Wk  Team                        Need  In DB  Action');
console.log('-'.repeat(75));

for (const [key, g] of Object.entries(grouped).sort((a,b) => {
  const [as, aw] = a[0].split('-').map(Number);
  const [bs, bw] = b[0].split('-').map(Number);
  return as - bs || aw - bw;
})) {
  const existing = existingPenaltyMap[key] || 0;
  const needed = g.count;
  if (existing >= needed) {
    console.log(`${g.season.padEnd(10)}  ${String(g.week).padStart(2)}  ${g.csvTeam.padEnd(28)} ${needed}     ${existing}    SKIP`);
    skippedCount += needed;
  } else {
    const toAdd = needed - existing;
    console.log(`${g.season.padEnd(10)}  ${String(g.week).padStart(2)}  ${g.csvTeam.padEnd(28)} ${needed}     ${existing}    INSERT ${toAdd}`);
    for (let i = 0; i < toAdd; i++) {
      toInsert.push({ seasonID: g.seasonID, week: g.week, teamID: g.teamID });
    }
  }
}

// --- Step 3: Ghost team rows ---
const ghostGrouped = {};
for (const g of ghostRows) {
  const key = `${g.seasonID}-${g.week}`;
  if (!ghostGrouped[key]) ghostGrouped[key] = { ...g, count: 0 };
  ghostGrouped[key].count++;
}

const ghostInserts = [];
console.log('\n=== GHOST TEAM ROWS ===');
console.log('Season      Wk  Count');
console.log('-'.repeat(40));
for (const [key, g] of Object.entries(ghostGrouped).sort((a,b) => {
  const [as, aw] = a[0].split('-').map(Number);
  const [bs, bw] = b[0].split('-').map(Number);
  return as - bs || aw - bw;
})) {
  console.log(`${g.season.padEnd(10)}  ${String(g.week).padStart(2)}  ${g.count}`);
  for (let i = 0; i < g.count; i++) {
    ghostInserts.push({ seasonID: g.seasonID, week: g.week });
  }
}

console.log(`\n=== SUMMARY ===`);
console.log(`  Real penalty rows to insert: ${toInsert.length}`);
console.log(`  Ghost team rows to insert:   ${ghostInserts.length}`);
console.log(`  Already in DB (skipped):     ${skippedCount}`);
console.log(`  Total inserts:               ${toInsert.length + ghostInserts.length}`);
if (unresolvedNames.size) {
  console.log(`  Unresolved (${unresolvedNames.size}):`);
  for (const u of [...unresolvedNames].sort()) console.log(`    ${u}`);
}

if (process.argv.includes('--execute')) {
  console.log('\n--- EXECUTING INSERTS ---');
  let count = 0;

  // Insert real penalty rows
  for (const row of toInsert) {
    await pool.request()
      .input('bowlerID', sql.Int, 629)
      .input('seasonID', sql.Int, row.seasonID)
      .input('teamID', sql.Int, row.teamID)
      .input('week', sql.Int, row.week)
      .input('isPenalty', sql.Bit, 1)
      .query(`INSERT INTO scores (bowlerID, seasonID, teamID, week, isPenalty)
              VALUES (@bowlerID, @seasonID, @teamID, @week, @isPenalty)`);
    count++;
  }
  console.log(`Inserted ${count} real penalty rows`);

  // Insert ghost team rows
  let ghostCount = 0;
  for (const row of ghostInserts) {
    await pool.request()
      .input('bowlerID', sql.Int, 629)
      .input('seasonID', sql.Int, row.seasonID)
      .input('teamID', sql.Int, ghostTeamID)
      .input('week', sql.Int, row.week)
      .input('isPenalty', sql.Bit, 1)
      .query(`INSERT INTO scores (bowlerID, seasonID, teamID, week, isPenalty)
              VALUES (@bowlerID, @seasonID, @teamID, @week, @isPenalty)`);
    ghostCount++;
  }
  console.log(`Inserted ${ghostCount} ghost team rows (teamID: ${ghostTeamID})`);
  console.log(`\nTotal inserted: ${count + ghostCount}`);
} else {
  console.log('\nDRY RUN — pass --execute to actually insert');
}

await pool.close();
