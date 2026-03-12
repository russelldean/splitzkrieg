#!/usr/bin/env node
/**
 * Audit week-to-week incomingAvg jumps > 5 pts.
 * Rolling avg is 27-game across all seasons, so we order globally.
 * Only includes bowlers who have bowled 9+ non-penalty game-weeks in their career.
 */
import fs from 'fs';
import sql from 'mssql';

const envContent = fs.readFileSync('.env.local', 'utf8');
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim();
}

const config = {
  server: process.env.AZURE_SQL_SERVER,
  database: process.env.AZURE_SQL_DATABASE,
  user: process.env.AZURE_SQL_USER,
  password: process.env.AZURE_SQL_PASSWORD,
  options: { encrypt: true, trustServerCertificate: false, connectTimeout: 120000, requestTimeout: 120000 },
};

const pool = await sql.connect(config);

const result = await pool.request().query(`
  WITH careerCounts AS (
    SELECT bowlerID, COUNT(*) AS totalWeeks
    FROM scores WHERE isPenalty = 0
    GROUP BY bowlerID
    HAVING COUNT(*) >= 9
  ),
  ordered AS (
    SELECT
      s.bowlerID, b.bowlerName, s.seasonID, se.romanNumeral, se.period, se.year,
      s.week, s.incomingAvg, s.game1, s.game2, s.game3, s.scratchSeries,
      ROW_NUMBER() OVER (PARTITION BY s.bowlerID ORDER BY s.seasonID, s.week) AS gameNum,
      LAG(s.incomingAvg) OVER (PARTITION BY s.bowlerID ORDER BY s.seasonID, s.week) AS prevAvg,
      LAG(s.week) OVER (PARTITION BY s.bowlerID ORDER BY s.seasonID, s.week) AS prevWeek,
      LAG(se.romanNumeral) OVER (PARTITION BY s.bowlerID ORDER BY s.seasonID, s.week) AS prevSeason
    FROM scores s
    JOIN bowlers b ON b.bowlerID = s.bowlerID
    JOIN seasons se ON se.seasonID = s.seasonID
    JOIN careerCounts cc ON cc.bowlerID = s.bowlerID
    WHERE s.isPenalty = 0
      AND s.incomingAvg IS NOT NULL
  )
  SELECT
    bowlerID, bowlerName, romanNumeral, period, year, seasonID,
    prevWeek, prevSeason, week, gameNum,
    CAST(prevAvg AS INT) AS prevAvg,
    CAST(incomingAvg AS INT) AS incomingAvg,
    CAST(incomingAvg AS INT) - CAST(prevAvg AS INT) AS delta,
    game1, game2, game3, scratchSeries
  FROM ordered
  WHERE prevAvg IS NOT NULL
    AND ABS(CAST(incomingAvg AS INT) - CAST(prevAvg AS INT)) > 5
    AND gameNum >= 9
  ORDER BY ABS(CAST(incomingAvg AS INT) - CAST(prevAvg AS INT)) DESC, seasonID, week
`);

console.log('Found', result.recordset.length, 'jumps > 5 pts (bowlers with 9+ career games, starting from game 9+)\n');

console.log(
  'Bowler'.padEnd(24),
  'Season'.padEnd(8),
  'Weeks'.padEnd(12),
  'Avg Change'.padEnd(14),
  'Delta'.padStart(5),
  ' Game#',
  ' Scores'
);
console.log('-'.repeat(105));

result.recordset.forEach(r => {
  const sign = r.delta > 0 ? '+' : '';
  const seasonLabel = r.prevSeason !== r.romanNumeral
    ? `S${r.prevSeason}->S${r.romanNumeral}`
    : `S${r.romanNumeral}`;
  console.log(
    r.bowlerName.padEnd(24),
    seasonLabel.padEnd(8),
    `W${r.prevWeek}->W${r.week}`.padEnd(12),
    `${r.prevAvg}->${r.incomingAvg}`.padEnd(14),
    `${sign}${r.delta}`.padStart(5),
    String(r.gameNum).padStart(5),
    ` ${r.game1}-${r.game2}-${r.game3}=${r.scratchSeries}`
  );
});

await pool.close();
