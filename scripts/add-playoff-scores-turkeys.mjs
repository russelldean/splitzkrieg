#!/usr/bin/env node
/**
 * Migration: add `turkeys` column to playoffScores.
 *
 * Mirrors the scores.turkeys column (INT NULL, max ~12). Captured per bowler
 * per playoff round so playoff turkeys feed milestone counters the same way
 * regular-season ones do.
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

  console.log('Adding turkeys column to playoffScores (if not exists)...');

  await pool.request().query(`
    IF NOT EXISTS (
      SELECT * FROM sys.columns
      WHERE Name = N'turkeys' AND Object_ID = Object_ID(N'playoffScores')
    )
    BEGIN
      ALTER TABLE playoffScores ADD turkeys INT NULL;
      PRINT 'Column added.';
    END
    ELSE
    BEGIN
      PRINT 'Column already exists, skipping.';
    END
  `);

  await pool.close();
  console.log('Done.');
}

main().catch(e => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
