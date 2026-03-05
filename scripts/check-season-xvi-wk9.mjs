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

// All weeks in season XVI
const weeks = await pool.request().query(`
  SELECT week, COUNT(*) as rows FROM scores WHERE seasonID = 16 GROUP BY week ORDER BY week
`);
console.log('Season XVI weeks in DB:');
for (const w of weeks.recordset) console.log(`  Week ${w.week}: ${w.rows} rows`);

// Week 9 detail
const res = await pool.request().query(`
  SELECT t.teamName, b.bowlerName, s.isPenalty, s.game1, s.game2, s.game3
  FROM scores s
  JOIN bowlers b ON s.bowlerID = b.bowlerID
  JOIN teams t ON s.teamID = t.teamID
  WHERE s.seasonID = 16 AND s.week = 9
  ORDER BY t.teamName, b.bowlerName
`);
console.log(`\nSeason XVI, Week 9 (${res.recordset.length} rows):`);
let curTeam = '';
for (const r of res.recordset) {
  if (r.teamName !== curTeam) { curTeam = r.teamName; console.log(`\n  ${curTeam}:`); }
  const pen = r.isPenalty ? ' [PENALTY]' : '';
  console.log(`    ${r.bowlerName} - ${r.game1 || 0}/${r.game2 || 0}/${r.game3 || 0}${pen}`);
}

// Teams with <4 bowlers in week 9
const short = await pool.request().query(`
  SELECT t.teamName, COUNT(*) as cnt
  FROM scores s JOIN teams t ON s.teamID = t.teamID
  WHERE s.seasonID = 16 AND s.week = 9
  GROUP BY t.teamName
  HAVING COUNT(*) < 4
  ORDER BY t.teamName
`);
console.log(`\n\nTeams with <4 bowlers in week 9: ${short.recordset.length}`);
for (const t of short.recordset) console.log(`  ${t.teamName}: ${t.cnt}`);

// Also check what big CSV says for XVI week 9
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

const csvText = readFileSync('docs/Splitzkrieg Database (Apr 2007 - Now) - Data Import (1).csv', 'utf8');
const csvRows = parseCSV(csvText).slice(1);
const csvXVI9 = csvRows.filter(r => r[14] === 'XVI' && r[0] === '9');
console.log(`\nBig CSV: Season XVI Week 9 rows: ${csvXVI9.length}`);
const csvTeams = {};
for (const r of csvXVI9) {
  const team = r[1];
  if (!csvTeams[team]) csvTeams[team] = [];
  csvTeams[team].push(r[2] || '(empty)');
}
for (const [team, bowlers] of Object.entries(csvTeams).sort()) {
  console.log(`  ${team}: ${bowlers.join(', ')}`);
}

await pool.close();
