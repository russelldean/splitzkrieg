/**
 * Add nightNumber column to schedule table and backfill it.
 *
 * nightNumber = cumulative league night across all seasons, ordered chronologically.
 * e.g. Season I Week 1 = 1, Season I Week 2 = 2, ..., Season II Week 1 = 12, etc.
 *
 * Usage: node scripts/add-night-number.mjs [--dry-run]
 */
import sql from 'mssql';
import { readFileSync } from 'fs';

const dryRun = process.argv.includes('--dry-run');

const envContent = readFileSync('.env.local', 'utf8');
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim();
}

const dbConfig = {
  server: process.env.AZURE_SQL_SERVER,
  database: process.env.AZURE_SQL_DATABASE,
  user: process.env.AZURE_SQL_USER,
  password: process.env.AZURE_SQL_PASSWORD,
  options: { encrypt: true, trustServerCertificate: false, connectTimeout: 120000, requestTimeout: 60000 },
};

async function main() {
  const pool = await sql.connect(dbConfig);

  // Check if column already exists
  const colCheck = await pool.request().query(`
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'schedule' AND COLUMN_NAME = 'nightNumber'
  `);

  if (colCheck.recordset.length === 0) {
    console.log('Adding nightNumber column to schedule...');
    if (!dryRun) {
      await pool.request().query(`ALTER TABLE schedule ADD nightNumber INT NULL`);
    }
  } else {
    console.log('nightNumber column already exists.');
  }

  // Preview the values
  const preview = await pool.request().query(`
    SELECT
      sch.seasonID, sch.week,
      DENSE_RANK() OVER (
        ORDER BY sn.year, CASE sn.period WHEN 'Spring' THEN 1 ELSE 2 END, sch.week
      ) AS nightNumber
    FROM (SELECT DISTINCT seasonID, week FROM schedule) sch
    JOIN seasons sn ON sn.seasonID = sch.seasonID
    ORDER BY nightNumber
  `);

  console.log(`Total league nights: ${preview.recordset.length}`);
  console.log('First 5:', preview.recordset.slice(0, 5));
  console.log('Last 5:', preview.recordset.slice(-5));

  if (dryRun) {
    console.log('Dry run, skipping update.');
    await pool.close();
    return;
  }

  // Backfill
  console.log('Backfilling nightNumber...');
  const result = await pool.request().query(`
    WITH numbered AS (
      SELECT
        sch.seasonID, sch.week,
        DENSE_RANK() OVER (
          ORDER BY sn.year, CASE sn.period WHEN 'Spring' THEN 1 ELSE 2 END, sch.week
        ) AS nightNumber
      FROM (SELECT DISTINCT seasonID, week FROM schedule) sch
      JOIN seasons sn ON sn.seasonID = sch.seasonID
    )
    UPDATE s
    SET s.nightNumber = n.nightNumber
    FROM schedule s
    JOIN numbered n ON n.seasonID = s.seasonID AND n.week = s.week
  `);

  console.log(`Updated ${result.rowsAffected[0]} rows.`);

  // Verify
  const nullCount = await pool.request().query(
    `SELECT COUNT(*) AS cnt FROM schedule WHERE nightNumber IS NULL`
  );
  console.log(`Rows with NULL nightNumber: ${nullCount.recordset[0].cnt}`);

  await pool.close();
  console.log('Done.');
}

main().catch(err => { console.error(err); process.exit(1); });
