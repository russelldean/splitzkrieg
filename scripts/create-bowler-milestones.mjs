#!/usr/bin/env node
/**
 * One-time setup: Create the bowlerMilestones table.
 *
 * Stores the season/week when a bowler crosses a milestone threshold
 * (e.g., 50,000 Career Pins, 100 200+ Games).
 *
 * Usage:
 *   node scripts/create-bowler-milestones.mjs
 */

import sql from 'mssql';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');

// Load env
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

  console.log('Creating bowlerMilestones table (if not exists)...');

  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'bowlerMilestones')
    BEGIN
      CREATE TABLE bowlerMilestones (
        id          INT IDENTITY(1,1) PRIMARY KEY,
        bowlerID    INT NOT NULL REFERENCES bowlers(bowlerID),
        category    VARCHAR(30) NOT NULL,   -- totalGames, totalPins, games200Plus, series600Plus, totalTurkeys
        threshold   INT NOT NULL,           -- 50000, 100, etc.
        seasonID    INT NOT NULL REFERENCES seasons(seasonID),
        week        INT NOT NULL,
        CONSTRAINT UQ_BowlerMilestone UNIQUE(bowlerID, category, threshold)
      );

      CREATE INDEX IX_BowlerMilestones_SeasonWeek ON bowlerMilestones(seasonID, week);
      CREATE INDEX IX_BowlerMilestones_BowlerID ON bowlerMilestones(bowlerID);

      PRINT 'Table created.';
    END
    ELSE
    BEGIN
      PRINT 'Table already exists, skipping creation.';
    END
  `);

  // Verify
  const result = await pool.request().query(
    `SELECT COUNT(*) AS cnt FROM bowlerMilestones`
  );
  console.log(`bowlerMilestones: ${result.recordset[0].cnt} rows`);

  await pool.close();
  console.log('Done.');
}

main().catch(e => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
