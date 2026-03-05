import sql from 'mssql';
import { readFileSync } from 'fs';

const env = readFileSync('.env.local', 'utf8');
for (const line of env.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim();
}

const pool = await new sql.ConnectionPool({
  server: process.env.AZURE_SQL_SERVER,
  database: process.env.AZURE_SQL_DATABASE,
  user: process.env.AZURE_SQL_USER,
  password: process.env.AZURE_SQL_PASSWORD,
  options: { encrypt: true, trustServerCertificate: false, connectTimeout: 120000, requestTimeout: 30000 },
}).connect();

// 1. All distinct team names alphabetically
console.log('=== ALL DISTINCT TEAM NAMES ===');
const names = await pool.request().query(`
  SELECT DISTINCT teamName FROM teamNameHistory ORDER BY teamName
`);
for (const r of names.recordset) console.log(`  "${r.teamName}"`);
console.log(`\nTotal distinct names: ${names.recordset.length}\n`);

// 2. Check for near-duplicates
console.log('=== POTENTIAL DUPLICATES (case/whitespace/punctuation) ===');
const nameList = names.recordset.map(r => r.teamName);
let dupeFound = false;
for (let i = 0; i < nameList.length; i++) {
  for (let j = i + 1; j < nameList.length; j++) {
    const a = nameList[i].toLowerCase().replace(/\s+/g, ' ').trim();
    const b = nameList[j].toLowerCase().replace(/\s+/g, ' ').trim();
    if (a === b) {
      console.log(`  EXACT (case): "${nameList[i]}" vs "${nameList[j]}"`);
      dupeFound = true;
    } else if (a.replace(/[^a-z0-9]/g, '') === b.replace(/[^a-z0-9]/g, '')) {
      console.log(`  SIMILAR (punctuation): "${nameList[i]}" vs "${nameList[j]}"`);
      dupeFound = true;
    }
  }
}
if (!dupeFound) console.log('  None found');

// 3. Substring matches
console.log('\n=== SUBSTRING MATCHES (possible truncations/typos) ===');
let subFound = false;
for (let i = 0; i < nameList.length; i++) {
  for (let j = i + 1; j < nameList.length; j++) {
    const a = nameList[i].toLowerCase();
    const b = nameList[j].toLowerCase();
    if (a.length > 5 && b.startsWith(a.slice(0, Math.floor(a.length * 0.8)))) {
      console.log(`  "${nameList[i]}" ~ "${nameList[j]}"`);
      subFound = true;
    } else if (b.length > 5 && a.startsWith(b.slice(0, Math.floor(b.length * 0.8)))) {
      console.log(`  "${nameList[j]}" ~ "${nameList[i]}"`);
      subFound = true;
    }
  }
}
if (!subFound) console.log('  None found');

// 4. Teams per season
console.log('\n=== TEAMS PER SEASON ===');
const perSeason = await pool.request().query(`
  SELECT seasonID, COUNT(*) as teamCount
  FROM teamNameHistory
  GROUP BY seasonID
  ORDER BY seasonID
`);
for (const r of perSeason.recordset) {
  const flag = (r.teamCount < 10 || r.teamCount > 20) ? ' <-- UNUSUAL' : '';
  console.log(`  Season ${String(r.seasonID).padStart(2)}: ${r.teamCount} teams${flag}`);
}

// 5. Same name, different teamID in same season
console.log('\n=== SAME NAME, DIFFERENT TEAM ID (same season) ===');
const dupes = await pool.request().query(`
  SELECT seasonID, teamName, COUNT(DISTINCT teamID) as cnt
  FROM teamNameHistory
  GROUP BY seasonID, teamName
  HAVING COUNT(DISTINCT teamID) > 1
`);
if (dupes.recordset.length === 0) console.log('  None found');
for (const r of dupes.recordset) {
  console.log(`  Season ${r.seasonID}: "${r.teamName}" used by ${r.cnt} different teamIDs`);
}

// 6. Franchise name journey per teamID
console.log('\n=== FRANCHISE NAME HISTORY (teamID journey) ===');
const journeys = await pool.request().query(`
  SELECT teamID, STRING_AGG(teamName, ' -> ') WITHIN GROUP (ORDER BY seasonID) as journey,
         MIN(seasonID) as firstSeason, MAX(seasonID) as lastSeason, COUNT(*) as seasons
  FROM teamNameHistory
  GROUP BY teamID
  ORDER BY teamID
`);
for (const r of journeys.recordset) {
  console.log(`  Team ${String(r.teamID).padStart(2)} (S${r.firstSeason}-S${r.lastSeason}, ${r.seasons} seasons): ${r.journey}`);
}

// 7. Total
const total = await pool.request().query(`SELECT COUNT(*) as cnt FROM teamNameHistory`);
console.log(`\nTotal rows: ${total.recordset[0].cnt}`);

await pool.close();
