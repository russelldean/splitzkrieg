#!/usr/bin/env node

/**
 * Create the announcements table in Azure SQL.
 * Safe to run multiple times (uses IF NOT EXISTS).
 *
 * Usage: node scripts/create-announcements-table.mjs
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
  options: { encrypt: true, trustServerCertificate: false },
};

async function main() {
  const pool = await sql.connect(config);

  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'announcements')
    BEGIN
      CREATE TABLE announcements (
        announcementID INT IDENTITY(1,1) PRIMARY KEY,
        message NVARCHAR(500) NOT NULL,
        type VARCHAR(20) NOT NULL DEFAULT 'info',
        expires DATE NULL,
        createdDate DATETIME2 NOT NULL DEFAULT GETDATE()
      );
      PRINT 'Created announcements table';
    END
    ELSE
      PRINT 'announcements table already exists';
  `);

  // Seed the existing announcement if the table is empty
  const count = await pool.request().query('SELECT COUNT(*) AS n FROM announcements');
  if (count.recordset[0].n === 0) {
    await pool.request().query(`
      INSERT INTO announcements (message, type, expires)
      VALUES ('Snow makeup date scheduled for April 13th', 'info', '2026-04-14');
    `);
    console.log('Seeded 1 existing announcement');
  }

  console.log('Done.');
  await pool.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
