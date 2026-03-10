#!/usr/bin/env node
/**
 * One-time setup: Create the leagueSettings table and seed initial values.
 *
 * Usage:
 *   node scripts/create-league-settings.mjs
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

  console.log('Creating leagueSettings table (if not exists)...');

  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'leagueSettings')
    BEGIN
      CREATE TABLE leagueSettings (
        settingKey VARCHAR(50) PRIMARY KEY,
        settingValue VARCHAR(255) NOT NULL
      );
      INSERT INTO leagueSettings (settingKey, settingValue) VALUES ('publishedWeek', '4');
      INSERT INTO leagueSettings (settingKey, settingValue) VALUES ('publishedSeasonID', '35');
      PRINT 'Table created and seeded.';
    END
    ELSE
    BEGIN
      PRINT 'Table already exists, skipping creation.';
      -- Ensure seed rows exist
      IF NOT EXISTS (SELECT 1 FROM leagueSettings WHERE settingKey = 'publishedWeek')
        INSERT INTO leagueSettings (settingKey, settingValue) VALUES ('publishedWeek', '4');
      IF NOT EXISTS (SELECT 1 FROM leagueSettings WHERE settingKey = 'publishedSeasonID')
        INSERT INTO leagueSettings (settingKey, settingValue) VALUES ('publishedSeasonID', '35');
    END
  `);

  // Verify
  const result = await pool.request().query('SELECT * FROM leagueSettings');
  console.log('Current settings:');
  for (const row of result.recordset) {
    console.log(`  ${row.settingKey} = ${row.settingValue}`);
  }

  await pool.close();
  console.log('Done.');
}

main().catch(e => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
