#!/usr/bin/env node

/**
 * Create the securityEvents table in Azure SQL.
 * Durable forensic log of alert-worthy security events (brute-force trips, etc).
 * Routine failed-login attempts are NOT stored here — they go to Vercel logs only.
 *
 * Usage: node scripts/create-security-events-table.mjs
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
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'securityEvents')
    BEGIN
      CREATE TABLE securityEvents (
        eventID INT IDENTITY(1,1) PRIMARY KEY,
        eventType VARCHAR(50) NOT NULL,
        ip VARCHAR(64) NULL,
        userAgent NVARCHAR(500) NULL,
        details NVARCHAR(MAX) NULL,
        createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
      );
      CREATE INDEX ix_securityEvents_created ON securityEvents(createdAt DESC);
      PRINT 'Created securityEvents table';
    END
    ELSE
      PRINT 'securityEvents table already exists';
  `);

  console.log('Done.');
  await pool.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
