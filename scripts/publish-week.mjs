#!/usr/bin/env node
/**
 * Publish a week: update the publishedWeek and publishedSeasonID in leagueSettings.
 *
 * Usage:
 *   node scripts/publish-week.mjs --week=5
 *   node scripts/publish-week.mjs --week=5 --season=35
 *
 * The publish gate controls which week shows on the homepage and bowler profiles.
 * League night pages are NOT gated — they show any week with data.
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

// Parse args
const args = process.argv.slice(2);
const getArg = (prefix) => args.find(a => a.startsWith(prefix))?.replace(prefix, '') ?? null;

const weekNum = parseInt(getArg('--week='), 10);
const seasonID = parseInt(getArg('--season=') ?? '35', 10);

if (!weekNum || isNaN(weekNum)) {
  console.error('Usage: node scripts/publish-week.mjs --week=N [--season=N]');
  console.error('  --week=N     Required. Week number to publish.');
  console.error('  --season=N   Optional. Season ID (default: 35).');
  process.exit(1);
}

async function main() {
  const pool = await new sql.ConnectionPool(dbConfig).connect();

  // Verify the table exists
  const tableCheck = await pool.request().query(`
    SELECT COUNT(*) AS cnt FROM sys.tables WHERE name = 'leagueSettings'
  `);
  if (tableCheck.recordset[0].cnt === 0) {
    console.error('ERROR: leagueSettings table does not exist.');
    console.error('Run: node scripts/create-league-settings.mjs');
    await pool.close();
    process.exit(1);
  }

  // Update published week
  await pool.request()
    .input('val', sql.VarChar(255), String(weekNum))
    .query(`UPDATE leagueSettings SET settingValue = @val WHERE settingKey = 'publishedWeek'`);

  // Update published season
  await pool.request()
    .input('val', sql.VarChar(255), String(seasonID))
    .query(`UPDATE leagueSettings SET settingValue = @val WHERE settingKey = 'publishedSeasonID'`);

  // Confirm
  const result = await pool.request().query('SELECT * FROM leagueSettings');
  console.log('Published: Season ' + seasonID + ', Week ' + weekNum);
  console.log('');
  console.log('Current settings:');
  for (const row of result.recordset) {
    console.log('  ' + row.settingKey + ' = ' + row.settingValue);
  }

  await pool.close();

  console.log('');
  console.log('Remember to bust cache and redeploy for changes to take effect.');
  console.log('The SQL text in homepage/profile queries changed with the publish gate,');
  console.log('so cached results from the old MAX(week) queries are already invalidated.');
}

main().catch(e => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
