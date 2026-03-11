#!/usr/bin/env node
/**
 * Auto-generate memory/db-schema.md from INFORMATION_SCHEMA.
 *
 * Queries the live DB for all tables, columns, and row counts,
 * then writes a fresh schema doc. Run manually or via Claude Code
 * SessionStart hook so the schema is always current.
 *
 * Usage:
 *   node scripts/refresh-schema.mjs
 */

import sql from 'mssql';
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');
const MEMORY_DIR = resolve(
  process.env.HOME,
  '.claude/projects/-Users-russdean-Projects-splitzkrieg/memory'
);
const OUTPUT = resolve(MEMORY_DIR, 'db-schema.md');

// Load env
const envContent = readFileSync(resolve(PROJECT_ROOT, '.env.local'), 'utf8');
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim();
}

const config = {
  server: process.env.AZURE_SQL_SERVER,
  database: process.env.AZURE_SQL_DATABASE,
  user: process.env.AZURE_SQL_USER,
  password: process.env.AZURE_SQL_PASSWORD,
  options: { encrypt: true },
};

async function main() {
  const pool = await sql.connect(config);

  // Get all user tables
  const tables = await pool.query(`
    SELECT TABLE_NAME
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_TYPE = 'BASE TABLE'
    ORDER BY TABLE_NAME
  `);

  // Get all columns with types and constraints
  const columns = await pool.query(`
    SELECT
      c.TABLE_NAME,
      c.COLUMN_NAME,
      c.DATA_TYPE,
      c.CHARACTER_MAXIMUM_LENGTH,
      c.IS_NULLABLE,
      c.COLUMN_DEFAULT,
      COLUMNPROPERTY(OBJECT_ID(c.TABLE_SCHEMA + '.' + c.TABLE_NAME), c.COLUMN_NAME, 'IsIdentity') AS is_identity,
      COLUMNPROPERTY(OBJECT_ID(c.TABLE_SCHEMA + '.' + c.TABLE_NAME), c.COLUMN_NAME, 'IsComputed') AS is_computed
    FROM INFORMATION_SCHEMA.COLUMNS c
    ORDER BY c.TABLE_NAME, c.ORDINAL_POSITION
  `);

  // Get row counts
  const counts = await pool.query(`
    SELECT t.name AS TABLE_NAME, p.rows AS row_count
    FROM sys.tables t
    JOIN sys.partitions p ON t.object_id = p.object_id AND p.index_id IN (0, 1)
    ORDER BY t.name
  `);
  const countMap = new Map(counts.recordset.map(r => [r.TABLE_NAME, r.row_count]));

  // Get foreign keys
  const fks = await pool.query(`
    SELECT
      OBJECT_NAME(fkc.parent_object_id) AS from_table,
      COL_NAME(fkc.parent_object_id, fkc.parent_column_id) AS from_col,
      OBJECT_NAME(fkc.referenced_object_id) AS to_table,
      COL_NAME(fkc.referenced_object_id, fkc.referenced_column_id) AS to_col
    FROM sys.foreign_key_columns fkc
    ORDER BY from_table, from_col
  `);
  const fkMap = new Map();
  for (const fk of fks.recordset) {
    fkMap.set(`${fk.from_table}.${fk.from_col}`, `${fk.to_table}.${fk.to_col}`);
  }

  // Get quick facts
  const facts = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM bowlers) AS totalBowlers,
      (SELECT COUNT(*) FROM seasons) AS totalSeasons,
      (SELECT MIN(year) FROM seasons) AS firstYear,
      (SELECT MAX(year) FROM seasons) AS latestYear,
      (SELECT COUNT(*) FROM scores) AS totalScoreRows,
      (SELECT COUNT(*) FROM teams) AS totalTeams
  `);
  const f = facts.recordset[0];

  // Group columns by table
  const colsByTable = new Map();
  for (const col of columns.recordset) {
    if (!colsByTable.has(col.TABLE_NAME)) colsByTable.set(col.TABLE_NAME, []);
    colsByTable.get(col.TABLE_NAME).push(col);
  }

  // Build output
  const now = new Date().toISOString().slice(0, 10);
  const lines = [
    `# Database Schema (Azure SQL)`,
    ``,
    `Auto-generated ${now} by \`scripts/refresh-schema.mjs\`. Do not edit manually.`,
    ``,
    `## Quick Facts`,
    `- **${f.totalBowlers} bowlers** across **${f.totalSeasons} seasons** (${f.firstYear}–${f.latestYear})`,
    `- ${f.totalScoreRows.toLocaleString()} score rows, ${f.totalTeams} teams`,
    `- League years: ${f.latestYear - f.firstYear + 1} years of history`,
    ``,
  ];

  for (const table of tables.recordset) {
    const name = table.TABLE_NAME;
    const count = countMap.get(name) ?? '?';
    const cols = colsByTable.get(name) ?? [];

    lines.push(`## ${name} (${count.toLocaleString()} rows)`);

    for (const col of cols) {
      let type = col.DATA_TYPE;
      if (col.CHARACTER_MAXIMUM_LENGTH && col.CHARACTER_MAXIMUM_LENGTH > 0) {
        type += `(${col.CHARACTER_MAXIMUM_LENGTH})`;
      }

      const tags = [];
      if (col.is_identity) tags.push('identity');
      if (col.is_computed) tags.push('computed');
      if (col.IS_NULLABLE === 'NO' && !col.is_identity) tags.push('NOT NULL');

      const fkKey = `${name}.${col.COLUMN_NAME}`;
      if (fkMap.has(fkKey)) tags.push(`FK→${fkMap.get(fkKey)}`);

      const tagStr = tags.length ? ` — ${tags.join(', ')}` : '';
      lines.push(`- \`${col.COLUMN_NAME}\` ${type}${tagStr}`);
    }

    lines.push('');
  }

  // Add known gotchas
  lines.push(`## Known Gotchas`);
  lines.push(`- \`scores\` computed columns (scratchSeries, incomingHcp, hcpGame1/2/3, handSeries) — NEVER INSERT these`);
  lines.push(`- \`matchDate\` lives on \`schedule\`, NOT on \`scores\``);
  lines.push(`- \`incomingAvg\` is decimal but ALWAYS stored as whole number`);
  lines.push(`- Season slugs use format: \`{period}-{year}\` (e.g., spring-2026)`);
  lines.push(`- Bowler slugs: \`LOWER(firstName-lastName)\``);
  lines.push('');

  writeFileSync(OUTPUT, lines.join('\n'));
  console.log(`Updated ${OUTPUT}`);
  console.log(`  ${tables.recordset.length} tables, ${f.totalBowlers} bowlers, ${f.totalSeasons} seasons`);

  await pool.close();
}

main().catch(e => {
  console.error('refresh-schema failed:', e.message);
  process.exit(1);
});
