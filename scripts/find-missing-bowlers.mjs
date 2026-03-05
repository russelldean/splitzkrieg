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

// Find first two seasons to exclude
const first2 = await pool.request().query(`
  SELECT TOP 2 seasonID, displayName FROM seasons ORDER BY seasonID
`);
console.log('Excluding (incomplete data entry, not penalty):');
for (const r of first2.recordset) console.log(`  ${r.displayName} (ID: ${r.seasonID})`);

const excludeIDs = first2.recordset.map(r => r.seasonID).join(',');

// Find all team-weeks with <4 bowlers, excluding first two seasons
// Also show who IS there so you can check if anyone's missing
const res = await pool.request().query(`
  WITH teamWeek AS (
    SELECT s.seasonID, sea.displayName, s.week, s.teamID, t.teamName,
      COUNT(*) AS bowlers,
      4 - COUNT(*) AS missing
    FROM scores s
    JOIN teams t ON s.teamID = t.teamID
    JOIN seasons sea ON s.seasonID = sea.seasonID
    WHERE s.seasonID NOT IN (${excludeIDs})
    GROUP BY s.seasonID, sea.displayName, s.week, s.teamID, t.teamName
    HAVING COUNT(*) < 4
  )
  SELECT tw.*,
    (SELECT STRING_AGG(b.bowlerName, ', ')
     FROM scores sc
     JOIN bowlers b ON sc.bowlerID = b.bowlerID
     WHERE sc.seasonID = tw.seasonID AND sc.week = tw.week AND sc.teamID = tw.teamID
    ) AS bowlersPresent
  FROM teamWeek tw
  ORDER BY tw.seasonID, tw.week, tw.teamName
`);

let curSeason = '';
let totalMissing = 0;
for (const r of res.recordset) {
  if (r.displayName !== curSeason) {
    if (curSeason) console.log('');
    curSeason = r.displayName;
    console.log(`\n--- ${curSeason} ---`);
  }
  console.log(`  Wk ${String(r.week).padStart(2)}  ${r.teamName.padEnd(25)} ${r.bowlers}/4 present (need ${r.missing})  [${r.bowlersPresent}]`);
  totalMissing += r.missing;
}
console.log(`\n\nTotal: ${res.recordset.length} team-weeks, ~${totalMissing} penalty rows needed`);

await pool.close();
