#!/usr/bin/env node
/**
 * Creates the siteUpdates table and seeds it with existing entries from content/updates.ts.
 * Run once: node scripts/create-site-updates-table.mjs
 */

import sql from 'mssql';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

// Load .env.local manually (same pattern as other scripts)
const envContent = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8');
for (const line of envContent.split('\n')) {
  const match = line.match(/^([A-Z_]+)=(.*)$/);
  if (match) process.env[match[1]] = match[2].trim();
}

const config = {
  server: process.env.AZURE_SQL_SERVER,
  database: process.env.AZURE_SQL_DATABASE,
  user: process.env.AZURE_SQL_USER,
  password: process.env.AZURE_SQL_PASSWORD,
  options: { encrypt: true, trustServerCertificate: false },
};

// Existing updates from content/updates.ts (seeded in reverse so oldest gets lowest ID)
const existingUpdates = [
  { date: '2026-03-10', text: 'Switched domain from splitzkrieg.org to splitzkrieg.com', tag: 'feat' },
  { date: '2026-03-11', text: 'Blog page and featured post card', tag: 'feat' },
  { date: '2026-03-11', text: 'Site Updates feed on the Resources page', tag: 'feat' },
  { date: '2026-03-11', text: 'Week 4 scores are live', tag: 'feat' },
  { date: '2026-03-11', text: 'Fixed feedback button not clickable on desktop', tag: 'fix' },
  { date: '2026-03-11', text: 'Added three ??? to user profiles', tag: 'feat' },
  { date: '2026-03-11', text: 'Corrected 150+ historical average blips and recalculated affected stats', tag: 'fix' },
  { date: '2026-03-12', text: 'Photo headers on most index pages', tag: 'feat' },
  { date: '2026-03-12', text: 'Added share button to average progression chart', tag: 'feat' },
  { date: '2026-03-12', text: 'Announcement banner for league-wide notices (snow makeups, etc.)', tag: 'feat' },
  { date: '2026-03-12', text: 'Season XXV, XVII, XVI schedule data and cascading stats updated', tag: 'feat' },
  { date: '2026-03-12', text: 'Search now finds both bowlers and teams', tag: 'feat' },
  { date: '2026-03-12', text: 'Bowler debut order shown in ticker', tag: 'feat' },
  { date: '2026-03-12', text: 'W-L-T record now shows on team cards', tag: 'feat' },
  { date: '2026-03-13', text: 'League Timeline sorted by team debut order', tag: 'feat' },
  { date: '2026-03-13', text: 'Collapsible season accordion on weeks page', tag: 'feat' },
  { date: '2026-03-13', text: 'Added Season notes documenting known data gaps and quirks for all seasons', tag: 'feat' },
  { date: '2026-03-13', text: 'Ghost team forfeit scoring now displays correctly across all components', tag: 'fix' },
  { date: '2026-03-14', text: 'All 35 seasons now have complete schedule data', tag: 'feat' },
  { date: '2026-03-14', text: 'Corrected cross-division semifinal matchups for Seasons XVIII-XXII', tag: 'fix' },
  { date: '2026-03-14', text: 'Playoff head-to-head section on team pages with lifetime totals', tag: 'feat' },
  { date: '2026-03-14', text: 'Trophy icons next to individual champions in season stats and leaderboards', tag: 'feat' },
];

async function main() {
  const pool = await sql.connect(config);

  // Create table
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'siteUpdates')
    CREATE TABLE siteUpdates (
      updateID    INT IDENTITY(1,1) PRIMARY KEY,
      updateDate  DATE NOT NULL,
      text        NVARCHAR(500) NOT NULL,
      tag         VARCHAR(10) NOT NULL DEFAULT 'feat',
      sortOrder   INT NOT NULL DEFAULT 0,
      createdDate DATETIME2 NOT NULL DEFAULT GETDATE()
    )
  `);
  console.log('Table siteUpdates created (or already exists).');

  // Check if already seeded
  const count = await pool.request().query('SELECT COUNT(*) AS cnt FROM siteUpdates');
  if (count.recordset[0].cnt > 0) {
    console.log(`Table already has ${count.recordset[0].cnt} rows, skipping seed.`);
    await pool.close();
    return;
  }

  // Seed existing updates
  for (let i = 0; i < existingUpdates.length; i++) {
    const u = existingUpdates[i];
    await pool
      .request()
      .input('date', sql.Date, u.date)
      .input('text', sql.NVarChar(500), u.text)
      .input('tag', sql.VarChar(10), u.tag)
      .input('sortOrder', sql.Int, i)
      .query(
        'INSERT INTO siteUpdates (updateDate, text, tag, sortOrder) VALUES (@date, @text, @tag, @sortOrder)',
      );
  }
  console.log(`Seeded ${existingUpdates.length} updates.`);
  await pool.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
