import sql from 'mssql';
import { readFileSync } from 'fs';

const envContent = readFileSync('.env.local', 'utf8');
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim();
}

const dbConfig = {
  server: process.env.AZURE_SQL_SERVER,
  database: process.env.AZURE_SQL_DATABASE,
  user: process.env.AZURE_SQL_USER,
  password: process.env.AZURE_SQL_PASSWORD,
  options: { encrypt: true, trustServerCertificate: false },
};

// Teams currently active (lastSeason = 35), excluding the ones already hardcoded
const TEAMS = [
  'Alley Oops', 'Bowl Durham', 'E-Bowla', 'Fancy Pants', "Grandma's Teeth",
  'Gutterglory', 'Guttermouths', 'Guttersnipes', 'HOT FUN', 'Hot Shotz',
  'Living on a Spare', 'Lucky Strikes', 'Pin-Ups', 'Smoke-a-Bowl',
  'Sparadigm Shift', 'Stinky Cheese', 'The Boom Kings', 'Thoughts and Spares',
  'Valley of the Balls', 'Wild Llamas',
];

async function main() {
  const pool = await new sql.ConnectionPool(dbConfig).connect();

  const results = {};

  for (const teamName of TEAMS) {
    const req1 = pool.request();
    req1.input('teamName', sql.NVarChar, teamName);
    const bowlersRes = await req1.query(`
      SELECT b.bowlerID, b.bowlerName, b.isActive,
        MIN(s.seasonID) as firstSeason,
        COUNT(DISTINCT s.seasonID) as totalNights
      FROM scores s
      JOIN bowlers b ON s.bowlerID = b.bowlerID
      JOIN teams t ON s.teamID = t.teamID
      WHERE t.teamName = @teamName
        AND b.bowlerID != 629
      GROUP BY b.bowlerID, b.bowlerName, b.isActive
      ORDER BY MIN(s.seasonID), b.bowlerName
    `);

    const req2 = pool.request();
    req2.input('teamName', sql.NVarChar, teamName);
    const pairsRes = await req2.query(`
      SELECT
        s1.bowlerID as id1,
        s2.bowlerID as id2,
        COUNT(*) as coNights
      FROM scores s1
      JOIN scores s2
        ON s1.seasonID = s2.seasonID
        AND s1.week = s2.week
        AND s1.teamID = s2.teamID
        AND s1.bowlerID < s2.bowlerID
      JOIN teams t ON s1.teamID = t.teamID
      WHERE t.teamName = @teamName
        AND s1.bowlerID != 629
        AND s2.bowlerID != 629
      GROUP BY s1.bowlerID, s2.bowlerID
      ORDER BY COUNT(*) DESC
    `);

    const req3 = pool.request();
    req3.input('teamName', sql.NVarChar, teamName);
    const nightsRes = await req3.query(`
      SELECT b.bowlerID, COUNT(*) as nights
      FROM scores s
      JOIN bowlers b ON s.bowlerID = b.bowlerID
      JOIN teams t ON s.teamID = t.teamID
      WHERE t.teamName = @teamName
        AND b.bowlerID != 629
      GROUP BY b.bowlerID
    `);

    // Championship counts: bowlers who bowled 3+ nights in a Team championship season
    const req4 = pool.request();
    req4.input('teamName', sql.NVarChar, teamName);
    const champsRes = await req4.query(`
      SELECT s.bowlerID, COUNT(*) as champCount
      FROM (
        SELECT sc.seasonID
        FROM seasonChampions sc
        JOIN teams t ON sc.winnerTeamID = t.teamID
        WHERE sc.championshipType = 'Team' AND t.teamName = @teamName
      ) champ
      JOIN scores s ON s.teamID = (
        SELECT TOP 1 t.teamID FROM teams t WHERE t.teamName = @teamName
      ) AND s.seasonID = champ.seasonID
      WHERE s.bowlerID != 629
      GROUP BY s.bowlerID, champ.seasonID
      HAVING COUNT(*) >= 3
    `);
    // Roll up: sum champCount across all championship seasons per bowler
    const champCounts = {};
    for (const row of champsRes.recordset) {
      champCounts[row.bowlerID] = (champCounts[row.bowlerID] || 0) + 1;
    }

    results[teamName] = {
      bowlers: bowlersRes.recordset,
      pairs: pairsRes.recordset,
      nights: nightsRes.recordset,
      champCounts,
    };

    process.stderr.write(`Fetched ${teamName}: ${bowlersRes.recordset.length} bowlers, ${pairsRes.recordset.length} pairs, ${Object.keys(champCounts).length} champ bowlers\n`);
  }

  await pool.close();

  console.log(JSON.stringify(results, null, 2));
}

main().catch(err => { console.error(err); process.exit(1); });
