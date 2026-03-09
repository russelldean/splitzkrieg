#!/usr/bin/env node
/**
 * Export bowlers with their most recent team, rolling average, and handicap.
 * Usage: node scripts/export-bowler-averages.mjs [--active | --inactive]
 * Default: --active. Output is tab-separated (paste into Google Sheets).
 */
import sql from 'mssql';
import { readFileSync } from 'fs';

const envContent = readFileSync('.env.local', 'utf8');
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim();
}

const config = {
  server: process.env.AZURE_SQL_SERVER,
  database: process.env.AZURE_SQL_DATABASE,
  user: process.env.AZURE_SQL_USER,
  password: process.env.AZURE_SQL_PASSWORD,
  options: { encrypt: true, trustServerCertificate: false, connectTimeout: 120000, requestTimeout: 60000 },
};

const args = process.argv.slice(2);
const inactive = args.includes('--inactive');
const label = inactive ? 'Inactive' : 'Active';

async function main() {
  const pool = await sql.connect(config);

  const result = await pool.request()
    .input('isActive', inactive ? 0 : 1)
    .query(`
    WITH lastTeam AS (
      -- Most recent team each bowler played for (across all seasons)
      SELECT sc.bowlerID, sc.teamID,
        ROW_NUMBER() OVER (
          PARTITION BY sc.bowlerID
          ORDER BY sn.year DESC, CASE sn.period WHEN 'Fall' THEN 2 ELSE 1 END DESC, sc.week DESC
        ) AS rn
      FROM scores sc
      JOIN seasons sn ON sc.seasonID = sn.seasonID
      WHERE sc.isPenalty = 0
    ),
    data AS (
      SELECT
        b.bowlerID,
        b.bowlerName,
        COALESCE(
          -- Use team name from that season's history if available
          (SELECT TOP 1 tnh.teamName FROM teamNameHistory tnh
           JOIN scores sc3 ON sc3.bowlerID = b.bowlerID AND sc3.teamID = lt.teamID
           WHERE tnh.teamID = lt.teamID AND tnh.seasonID = sc3.seasonID
           ORDER BY sc3.seasonID DESC),
          t.teamName
        ) AS teamName,
        COALESCE(
          (SELECT CAST(ROUND(AVG(CAST(g.game AS DECIMAL(10,2))), 0) AS INT)
           FROM (
             SELECT TOP 27 g.game
             FROM (
               SELECT sc2.game1 AS game, sn2.year, CASE sn2.period WHEN 'Fall' THEN 2 ELSE 1 END AS po, sc2.week, 1 AS gn
               FROM scores sc2 JOIN seasons sn2 ON sc2.seasonID = sn2.seasonID
               WHERE sc2.bowlerID = b.bowlerID AND sc2.isPenalty = 0 AND sc2.game1 > 0
               UNION ALL
               SELECT sc2.game2, sn2.year, CASE sn2.period WHEN 'Fall' THEN 2 ELSE 1 END, sc2.week, 2
               FROM scores sc2 JOIN seasons sn2 ON sc2.seasonID = sn2.seasonID
               WHERE sc2.bowlerID = b.bowlerID AND sc2.isPenalty = 0 AND sc2.game2 > 0
               UNION ALL
               SELECT sc2.game3, sn2.year, CASE sn2.period WHEN 'Fall' THEN 2 ELSE 1 END, sc2.week, 3
               FROM scores sc2 JOIN seasons sn2 ON sc2.seasonID = sn2.seasonID
               WHERE sc2.bowlerID = b.bowlerID AND sc2.isPenalty = 0 AND sc2.game3 > 0
             ) g
             ORDER BY g.year DESC, g.po DESC, g.week DESC, g.gn DESC
           ) g),
          b.establishedAvg
        ) AS rollingAvg
      FROM bowlers b
      JOIN lastTeam lt ON lt.bowlerID = b.bowlerID AND lt.rn = 1
      JOIN teams t ON lt.teamID = t.teamID
      WHERE b.isActive = @isActive
    )
    SELECT
      teamName,
      bowlerName,
      rollingAvg,
      CASE WHEN rollingAvg IS NOT NULL
        THEN CAST(GREATEST(0, FLOOR((225 - rollingAvg) * 0.95)) AS INT)
        ELSE NULL
      END AS handicap
    FROM data
    ORDER BY teamName, bowlerName
  `);

  console.log('Team\tBowler\tAverage\tHandicap');
  for (const r of result.recordset) {
    console.log(`${r.teamName}\t${r.bowlerName}\t${r.rollingAvg ?? ''}\t${r.handicap ?? ''}`);
  }

  console.error(`${label}: ${result.recordset.length} bowlers`);
  await pool.close();
}

main().catch(err => { console.error(err); process.exit(1); });
