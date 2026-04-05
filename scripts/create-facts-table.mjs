#!/usr/bin/env node
/**
 * Creates the factTypes and facts tables for random homepage facts.
 * Run once: node scripts/create-facts-table.mjs
 */

import sql from 'mssql';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

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

async function main() {
  const pool = await sql.connect(config);

  // --- factTypes lookup table ---
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'factTypes')
    CREATE TABLE factTypes (
      factTypeID  INT IDENTITY(1,1) PRIMARY KEY,
      code        VARCHAR(30) NOT NULL UNIQUE,
      name        NVARCHAR(100) NOT NULL
    )
  `);
  console.log('Table factTypes created (or already exists).');

  // Seed initial fact types
  const typeCount = (await pool.request().query('SELECT COUNT(*) AS cnt FROM factTypes')).recordset[0].cnt;
  if (typeCount === 0) {
    const types = [
      { code: 'high-game', name: 'Personal High Game' },
      { code: 'high-series', name: 'Personal High Series' },
    ];
    for (const t of types) {
      await pool.request()
        .input('code', sql.VarChar(30), t.code)
        .input('name', sql.NVarChar(100), t.name)
        .query('INSERT INTO factTypes (code, name) VALUES (@code, @name)');
    }
    console.log(`Seeded ${types.length} fact types.`);
  } else {
    console.log(`factTypes already has ${typeCount} rows, skipping seed.`);
  }

  // --- facts table ---
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'facts')
    CREATE TABLE facts (
      factID        INT IDENTITY(1,1) PRIMARY KEY,
      factTypeID    INT NOT NULL REFERENCES factTypes(factTypeID),
      bowlerID      INT NULL REFERENCES bowlers(bowlerID),
      seasonID      INT NULL REFERENCES seasons(seasonID),
      week          INT NULL,
      referenceDate DATE NULL,
      value         INT NULL,
      previousValue INT NULL,
      text          NVARCHAR(500) NULL,
      isActive      BIT NOT NULL DEFAULT 1
    )
  `);
  console.log('Table facts created (or already exists).');

  // Indexes
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_facts_factTypeID')
    CREATE INDEX IX_facts_factTypeID ON facts(factTypeID) WHERE isActive = 1
  `);
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_facts_referenceDate')
    CREATE INDEX IX_facts_referenceDate ON facts(referenceDate) WHERE isActive = 1
  `);
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_facts_bowlerID')
    CREATE INDEX IX_facts_bowlerID ON facts(bowlerID) WHERE isActive = 1
  `);
  console.log('Indexes created.');

  const count = (await pool.request().query('SELECT COUNT(*) AS cnt FROM facts')).recordset[0].cnt;
  console.log(`Facts table has ${count} rows.`);

  await pool.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
