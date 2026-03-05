import sql from 'mssql';
import { readFileSync } from 'fs';

const env = readFileSync('.env.local', 'utf8');
for (const line of env.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim();
}

// TSV team name -> DB team name (from bowler overlap matching)
const tsvToDb = {
  'Blame It on the Lane': 'Thoughts and Spares',
  'Mom Ballerz': 'Alley Oops',
  'Roll Your Own': 'Roll Your Own',
  'Fancy Pants': 'Fancy Pants',
  'Pin-Ups': 'Pin-Ups',
  'The Guttersnipes': 'The Guttersnipes',
  'Wild Llamas': 'Wild Llamas',
  'Jive Turkeys': 'Jive Turkeys',
};

// Parse TSV for penalty rows
const tsvText = readFileSync('docs/Splitzkrieg Raw Data - Copy of Season XV.tsv', 'utf8');
const tsvLines = tsvText.split('\n').slice(1).filter(l => l.trim());

const penalties = [];
for (const line of tsvLines) {
  const fields = line.split('\t');
  const week = parseInt(fields[0]);
  const team = fields[1]?.trim();
  const bowler = fields[2]?.trim();
  if (bowler === 'PENALTY' || (!bowler && team)) {
    penalties.push({ week, tsvTeam: team });
  }
}

console.log(`Found ${penalties.length} PENALTY rows in TSV for Season XV\n`);

const pool = await new sql.ConnectionPool({
  server: process.env.AZURE_SQL_SERVER,
  database: process.env.AZURE_SQL_DATABASE,
  user: process.env.AZURE_SQL_USER,
  password: process.env.AZURE_SQL_PASSWORD,
  options: { encrypt: true, trustServerCertificate: false, connectTimeout: 120000, requestTimeout: 30000 },
}).connect();

// Get team IDs
const teamsResult = await pool.request().query('SELECT teamID, teamName FROM teams');
const teamNameToId = {};
for (const t of teamsResult.recordset) teamNameToId[t.teamName] = t.teamID;

// Check existing penalties for season 15
const existing = await pool.request().query(`
  SELECT week, teamID, COUNT(*) as cnt FROM scores
  WHERE seasonID = 15 AND isPenalty = 1
  GROUP BY week, teamID
`);
const existingMap = {};
for (const r of existing.recordset) existingMap[`${r.week}-${r.teamID}`] = r.cnt;

// Resolve and check
const toInsert = [];
console.log('Week  TSV Team                   DB Team                    TeamID  Existing  Action');
console.log('-'.repeat(95));

for (const p of penalties) {
  const dbTeamName = tsvToDb[p.tsvTeam];
  if (!dbTeamName) {
    console.log(`${String(p.week).padStart(4)}  ${p.tsvTeam.padEnd(25)}  UNMAPPED — skipping`);
    continue;
  }
  const teamID = teamNameToId[dbTeamName];
  if (!teamID) {
    console.log(`${String(p.week).padStart(4)}  ${p.tsvTeam.padEnd(25)}  ${dbTeamName.padEnd(25)}  NO ID — skipping`);
    continue;
  }
  const key = `${p.week}-${teamID}`;
  const existCount = existingMap[key] || 0;

  if (existCount > 0) {
    console.log(`${String(p.week).padStart(4)}  ${p.tsvTeam.padEnd(25)}  ${dbTeamName.padEnd(25)}  ${String(teamID).padStart(4)}    ${existCount}         SKIP`);
  } else {
    console.log(`${String(p.week).padStart(4)}  ${p.tsvTeam.padEnd(25)}  ${dbTeamName.padEnd(25)}  ${String(teamID).padStart(4)}    ${existCount}         INSERT`);
    toInsert.push({ week: p.week, teamID });
  }
}

console.log(`\nTotal to insert: ${toInsert.length}`);

if (process.argv.includes('--execute')) {
  console.log('\n--- EXECUTING ---');
  let count = 0;
  for (const row of toInsert) {
    await pool.request()
      .input('bowlerID', sql.Int, 629)
      .input('seasonID', sql.Int, 15)
      .input('teamID', sql.Int, row.teamID)
      .input('week', sql.Int, row.week)
      .input('isPenalty', sql.Bit, 1)
      .query(`INSERT INTO scores (bowlerID, seasonID, teamID, week, isPenalty)
              VALUES (@bowlerID, @seasonID, @teamID, @week, @isPenalty)`);
    count++;
  }
  console.log(`Inserted ${count} penalty rows for Season XV`);
} else {
  console.log('\nDRY RUN — pass --execute to insert');
}

await pool.close();
