#!/usr/bin/env node
/**
 * One-time setup: Create the playoffScores table.
 *
 * Stores actual game scores from team semifinals/final and individual bracket
 * rounds. Isolated from the `scores` table so season stats stay clean.
 *
 * Usage:
 *   node scripts/create-playoff-scores-table.mjs
 */

import sql from 'mssql';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');

const envContent = readFileSync(resolve(PROJECT_ROOT, '.env.local'), 'utf8');
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

  console.log('Creating playoffScores table (if not exists)...');

  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'playoffScores')
    BEGIN
      CREATE TABLE playoffScores (
        playoffScoreID    INT IDENTITY(1,1) PRIMARY KEY,
        seasonID          INT NOT NULL REFERENCES seasons(seasonID),
        bowlerID          INT NOT NULL REFERENCES bowlers(bowlerID),
        round             INT NOT NULL,
        teamID            INT NULL REFERENCES teams(teamID),
        championshipType  VARCHAR(30) NULL,
        game1             INT NULL,
        game2             INT NULL,
        game3             INT NULL,
        incomingAvg       DECIMAL(5,1) NULL,
        scratchSeries     AS (ISNULL(game1,0) + ISNULL(game2,0) + ISNULL(game3,0)),
        incomingHcp       AS (CASE WHEN incomingAvg IS NULL THEN 0
                                   ELSE FLOOR((225 - FLOOR(incomingAvg)) * 0.95) END) PERSISTED,
        hcpGame1          AS (ISNULL(game1,0)
                              + (CASE WHEN incomingAvg IS NULL THEN 0
                                      ELSE FLOOR((225 - FLOOR(incomingAvg)) * 0.95) END)),
        hcpGame2          AS (ISNULL(game2,0)
                              + (CASE WHEN incomingAvg IS NULL THEN 0
                                      ELSE FLOOR((225 - FLOOR(incomingAvg)) * 0.95) END)),
        hcpGame3          AS (ISNULL(game3,0)
                              + (CASE WHEN incomingAvg IS NULL THEN 0
                                      ELSE FLOOR((225 - FLOOR(incomingAvg)) * 0.95) END)),
        handSeries        AS (ISNULL(game1,0) + ISNULL(game2,0) + ISNULL(game3,0)
                              + 3 * (CASE WHEN incomingAvg IS NULL THEN 0
                                          ELSE FLOOR((225 - FLOOR(incomingAvg)) * 0.95) END)),
        CONSTRAINT CK_playoffScores_role
          CHECK (teamID IS NOT NULL OR championshipType IS NOT NULL),
        CONSTRAINT CK_playoffScores_round
          CHECK (round IN (1, 2)),
        CONSTRAINT CK_playoffScores_type
          CHECK (championshipType IS NULL
                 OR championshipType IN ('MensScratch','WomensScratch','Handicap')),
        CONSTRAINT UQ_playoffScores_bowler_round
          UNIQUE (seasonID, bowlerID, round)
      );

      CREATE INDEX IX_playoffScores_season_round
        ON playoffScores (seasonID, round)
        INCLUDE (bowlerID, teamID, championshipType);

      PRINT 'Table created.';
    END
    ELSE
    BEGIN
      PRINT 'Table already exists, skipping creation.';
    END
  `);

  const result = await pool.request().query(
    `SELECT COUNT(*) AS cnt FROM playoffScores`
  );
  console.log(`playoffScores: ${result.recordset[0].cnt} rows`);

  await pool.close();
  console.log('Done.');
}

main().catch(e => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
