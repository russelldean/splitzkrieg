/**
 * One-off: clear turkeys column on S35 round 1 (semifinals).
 * Russ decided not to track turkeys for playoff weeks.
 * Sets the 5 rows that have turkeys > 0 back to NULL to match the rest.
 */
import sql from 'mssql';
import { readFileSync, writeFileSync } from 'fs';

const envContent = readFileSync('.env.local', 'utf8');
for (const line of envContent.split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim();
}

const pool = await new sql.ConnectionPool({
  server: process.env.AZURE_SQL_SERVER,
  database: process.env.AZURE_SQL_DATABASE,
  user: process.env.AZURE_SQL_USER,
  password: process.env.AZURE_SQL_PASSWORD,
  options: { encrypt: true, trustServerCertificate: false, connectTimeout: 60000, requestTimeout: 30000 },
}).connect();

const before = await pool.request().query(`
  SELECT playoffScoreID, bowlerID, turkeys FROM playoffScores
  WHERE seasonID = 35 AND round = 1 AND turkeys IS NOT NULL
`);
console.log(`Before: ${before.recordset.length} rows with turkeys recorded.`);

const result = await pool.request().query(`
  UPDATE playoffScores SET turkeys = NULL
  WHERE seasonID = 35 AND round = 1 AND turkeys IS NOT NULL
`);
console.log(`UPDATE affected ${result.rowsAffected[0]} rows.`);

const after = await pool.request().query(`
  SELECT COUNT(*) AS cnt FROM playoffScores
  WHERE seasonID = 35 AND round = 1 AND turkeys IS NOT NULL
`);
console.log(`After: ${after.recordset[0].cnt} rows with turkeys recorded.`);

await pool.close();

// Bump playoffScores cache channel for S35 so the next deploy busts the cache.
const versions = JSON.parse(readFileSync('.data-versions.json', 'utf8'));
versions.playoffScores ??= {};
const prev = versions.playoffScores['35'] ?? 1;
versions.playoffScores['35'] = prev + 1;
writeFileSync('.data-versions.json', JSON.stringify(versions, null, 2) + '\n');
console.log(`Bumped .data-versions.json playoffScores.35 from ${prev} to ${versions.playoffScores['35']}.`);
