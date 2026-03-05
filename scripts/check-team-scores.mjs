import sql from 'mssql';
import { readFileSync } from 'fs';

// Load .env.local manually
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
  options: {
    encrypt: true,
    trustServerCertificate: false,
    connectTimeout: 120000,
    requestTimeout: 30000,
  },
};

async function main() {
  const pool = await new sql.ConnectionPool(dbConfig).connect();

  // Find the current season
  const seasonRes = await pool.request().query(`
    SELECT TOP 5 seasonID, displayName FROM seasons ORDER BY seasonID DESC
  `);
  console.log('Recent seasons:', seasonRes.recordset.map(r => `${r.seasonID}: ${r.displayName}`));

  const season = seasonRes.recordset[0];
  const seasonID = season.seasonID;
  console.log(`\nUsing: ${season.displayName} (ID: ${seasonID})\n`);

  // Team handicap game totals per week
  const teamGames = await pool.request()
    .input('seasonID', sql.Int, seasonID)
    .query(`
    SELECT
      s.week,
      t.teamName,
      SUM(s.hcpGame1) AS teamGame1,
      SUM(s.hcpGame2) AS teamGame2,
      SUM(s.hcpGame3) AS teamGame3,
      SUM(s.hcpGame1 + s.hcpGame2 + s.hcpGame3) AS teamHcpSeries,
      SUM(s.game1 + s.game2 + s.game3) AS teamScratchSeries,
      COUNT(*) AS bowlerCount
    FROM scores s
    JOIN teams t ON s.teamID = t.teamID
    WHERE s.seasonID = @seasonID
      AND s.week <= 3
    GROUP BY s.week, t.teamName
    ORDER BY s.week, t.teamName
  `);

  // Print by week
  let currentWeek = 0;
  for (const row of teamGames.recordset) {
    if (row.week !== currentWeek) {
      currentWeek = row.week;
      console.log(`\n=== WEEK ${currentWeek} ===`);
      console.log('Team'.padEnd(25) + 'G1'.padStart(5) + 'G2'.padStart(5) + 'G3'.padStart(5) + '  HcpSer'.padStart(8) + '  ScrSer'.padStart(8) + '  #Bwl'.padStart(6));
      console.log('-'.repeat(62));
    }
    console.log(
      row.teamName.padEnd(25) +
      String(row.teamGame1).padStart(5) +
      String(row.teamGame2).padStart(5) +
      String(row.teamGame3).padStart(5) +
      String(row.teamHcpSeries).padStart(8) +
      String(row.teamScratchSeries).padStart(8) +
      String(row.bowlerCount).padStart(6)
    );
  }

  // Matchups from schedule
  console.log('\n\n=== MATCHUPS (from schedule table) ===');
  const schedule = await pool.request()
    .input('seasonID', sql.Int, seasonID)
    .query(`
    SELECT
      sch.week, sch.matchNumber,
      t1.teamName AS team1, t2.teamName AS team2,
      sch.division, sch.matchDate
    FROM schedule sch
    JOIN teams t1 ON sch.team1ID = t1.teamID
    JOIN teams t2 ON sch.team2ID = t2.teamID
    WHERE sch.seasonID = @seasonID
      AND sch.week <= 3
    ORDER BY sch.week, sch.matchNumber
  `);

  currentWeek = 0;
  for (const row of schedule.recordset) {
    if (row.week !== currentWeek) {
      currentWeek = row.week;
      console.log(`\nWeek ${currentWeek} (${row.matchDate?.toISOString().split('T')[0] || 'no date'}):`);
    }
    console.log(`  Match ${String(row.matchNumber).padStart(2)}: ${row.team1.padEnd(22)} vs ${row.team2}`);
  }

  await pool.close();
}

main().catch(err => { console.error(err); process.exit(1); });
