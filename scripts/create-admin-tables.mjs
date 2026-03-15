#!/usr/bin/env node
/**
 * One-time setup: Create admin-related tables for Phase 8 features.
 * Tables: blogPosts, lineupSubmissions, lineupEntries, captainSessions
 *
 * Usage:
 *   node scripts/create-admin-tables.mjs
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

  // 1. blogPosts
  console.log('Creating blogPosts table (if not exists)...');
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'blogPosts')
    BEGIN
      CREATE TABLE blogPosts (
        id INT IDENTITY(1,1) PRIMARY KEY,
        slug VARCHAR(255) NOT NULL UNIQUE,
        title NVARCHAR(500) NOT NULL,
        content NVARCHAR(MAX) NOT NULL,
        excerpt NVARCHAR(500),
        type VARCHAR(50) DEFAULT 'recap',
        seasonRomanNumeral VARCHAR(20),
        seasonSlug VARCHAR(100),
        week INT,
        heroImage VARCHAR(500),
        heroFocalY FLOAT,
        publishedAt DATETIME2,
        createdAt DATETIME2 DEFAULT GETDATE(),
        updatedAt DATETIME2 DEFAULT GETDATE()
      );
      PRINT 'blogPosts table created.';
    END
    ELSE
      PRINT 'blogPosts table already exists.';
  `);

  // 2. lineupSubmissions
  console.log('Creating lineupSubmissions table (if not exists)...');
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'lineupSubmissions')
    BEGIN
      CREATE TABLE lineupSubmissions (
        id INT IDENTITY(1,1) PRIMARY KEY,
        seasonID INT NOT NULL,
        week INT NOT NULL,
        teamID INT NOT NULL,
        submittedBy VARCHAR(100),
        submittedAt DATETIME2 DEFAULT GETDATE(),
        status VARCHAR(20) DEFAULT 'submitted',
        CONSTRAINT FK_lineup_team FOREIGN KEY (teamID) REFERENCES teams(teamID)
      );
      PRINT 'lineupSubmissions table created.';
    END
    ELSE
      PRINT 'lineupSubmissions table already exists.';
  `);

  // 3. lineupEntries
  console.log('Creating lineupEntries table (if not exists)...');
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'lineupEntries')
    BEGIN
      CREATE TABLE lineupEntries (
        id INT IDENTITY(1,1) PRIMARY KEY,
        submissionID INT NOT NULL,
        position INT NOT NULL,
        bowlerID INT,
        newBowlerName VARCHAR(200),
        CONSTRAINT FK_entry_submission FOREIGN KEY (submissionID) REFERENCES lineupSubmissions(id)
      );
      PRINT 'lineupEntries table created.';
    END
    ELSE
      PRINT 'lineupEntries table already exists.';
  `);

  // 4. captainSessions
  console.log('Creating captainSessions table (if not exists)...');
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'captainSessions')
    BEGIN
      CREATE TABLE captainSessions (
        id INT IDENTITY(1,1) PRIMARY KEY,
        teamID INT NOT NULL,
        captainName VARCHAR(100) NOT NULL,
        captainEmail VARCHAR(255) NOT NULL,
        token VARCHAR(500) NOT NULL,
        createdAt DATETIME2 DEFAULT GETDATE(),
        expiresAt DATETIME2 NOT NULL,
        revoked BIT DEFAULT 0,
        CONSTRAINT FK_captain_team FOREIGN KEY (teamID) REFERENCES teams(teamID)
      );
      PRINT 'captainSessions table created.';
    END
    ELSE
      PRINT 'captainSessions table already exists.';
  `);

  // Verify
  const result = await pool.request().query(`
    SELECT TABLE_NAME
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_NAME IN ('blogPosts', 'lineupSubmissions', 'lineupEntries', 'captainSessions')
    ORDER BY TABLE_NAME
  `);
  console.log('\nVerified tables:');
  for (const row of result.recordset) {
    console.log(`  ${row.TABLE_NAME}`);
  }

  await pool.close();
  console.log('\nDone.');
}

main().catch(e => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
