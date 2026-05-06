#!/usr/bin/env node
/**
 * One-time setup: Create the individualPlayoffParticipants table.
 *
 * Stores the 8 (round 1) or 4 (round 2) bowlers in each individual playoff
 * category (MensScratch, WomensScratch, Handicap) for a given season.
 * Pre-populated from leaderboards; admin can swap alternates before generating
 * scoresheets.
 *
 * Operational table — historical seasons (pre-S35) will not be backfilled.
 *
 * Usage:
 *   node scripts/create-individual-playoff-participants.mjs
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

  console.log('Creating individualPlayoffParticipants table (if not exists)...');

  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'individualPlayoffParticipants')
    BEGIN
      CREATE TABLE individualPlayoffParticipants (
        id                INT IDENTITY(1,1) PRIMARY KEY,
        seasonID          INT NOT NULL REFERENCES seasons(seasonID),
        championshipType  VARCHAR(30) NOT NULL,
        round             INT NOT NULL,
        position          INT NOT NULL,
        bowlerID          INT NOT NULL REFERENCES bowlers(bowlerID),
        CONSTRAINT UQ_IndividualPlayoffParticipants
          UNIQUE (seasonID, championshipType, round, position),
        CONSTRAINT CK_IPP_Type
          CHECK (championshipType IN ('MensScratch','WomensScratch','Handicap')),
        CONSTRAINT CK_IPP_Round
          CHECK (round IN (1, 2))
      );

      CREATE INDEX IX_IPP_SeasonType
        ON individualPlayoffParticipants (seasonID, championshipType);

      PRINT 'Table created.';
    END
    ELSE
    BEGIN
      PRINT 'Table already exists, skipping creation.';
    END
  `);

  const result = await pool.request().query(
    `SELECT COUNT(*) AS cnt FROM individualPlayoffParticipants`
  );
  console.log(`individualPlayoffParticipants: ${result.recordset[0].cnt} rows`);

  await pool.close();
  console.log('Done.');
}

main().catch(e => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
