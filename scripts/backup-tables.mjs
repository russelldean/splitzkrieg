/**
 * Local backup of all database tables to CSV files.
 * Usage: node scripts/backup-tables.mjs
 * Output: backups/YYYY-MM-DD/ directory with one CSV per table
 */
import sql from 'mssql';
import { readFileSync, mkdirSync, writeFileSync } from 'fs';
import path from 'path';

// Load env
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
  options: {
    encrypt: true,
    trustServerCertificate: false,
    connectTimeout: 120000,
    requestTimeout: 60000,
  },
};

const TABLES = [
  'bowlers',
  'teams',
  'seasons',
  'scores',
  'schedule',
  'matchResults',
  'teamNameHistory',
  'seasonChampions',
  'playoffResults',
];

function escapeCsv(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

async function main() {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const dir = path.join('backups', dateStr);
  mkdirSync(dir, { recursive: true });

  console.log(`Backing up to ${dir}/\n`);

  const pool = await sql.connect(dbConfig);
  let totalRows = 0;

  for (const table of TABLES) {
    try {
      const result = await pool.request().query(`SELECT * FROM ${table}`);
      const rows = result.recordset;

      if (rows.length === 0) {
        console.log(`  ${table}: empty, skipping`);
        continue;
      }

      const columns = Object.keys(rows[0]);
      const lines = [columns.map(escapeCsv).join(',')];
      for (const row of rows) {
        lines.push(columns.map(c => escapeCsv(row[c])).join(','));
      }

      const filePath = path.join(dir, `${table}.csv`);
      writeFileSync(filePath, lines.join('\n') + '\n');
      console.log(`  ${table}: ${rows.length} rows`);
      totalRows += rows.length;
    } catch (err) {
      console.error(`  ${table}: ERROR - ${err.message}`);
    }
  }

  await pool.close();
  console.log(`\nDone. ${totalRows} total rows across ${TABLES.length} tables.`);
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
