#!/usr/bin/env node
/**
 * Import Season II (seasonID=2) Weeks 16 & 17 from CSV files.
 * Replaces existing data for those weeks.
 *
 * Usage:
 *   node scripts/import-s2-weeks.mjs --dry-run   # preview
 *   node scripts/import-s2-weeks.mjs              # execute
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
  options: { encrypt: true, trustServerCertificate: false, requestTimeout: 30000 },
};

const SEASON_ID = 2;
const dryRun = process.argv.includes('--dry-run');

function parseCSV(filePath) {
  const lines = readFileSync(filePath, 'utf8').trim().split('\n');
  return lines.map(l => {
    const parts = l.split(',');
    const team = parts[0].trim();
    const name = parts[1].trim().replace(/\s*\*$/, '').replace(/\*$/, '');
    const g1 = parseInt(parts[2]);
    const g2 = parseInt(parts[3]);
    const g3 = parseInt(parts[4]);
    return { team, name, g1, g2, g3 };
  });
}

function norm(n) { return n.toLowerCase().replace(/[^a-z]/g, ''); }

async function main() {
  const csv16 = parseCSV(resolve(PROJECT_ROOT, 'docs/data/Untitled spreadsheet - week16.csv'));
  const csv17 = parseCSV(resolve(PROJECT_ROOT, 'docs/data/Untitled spreadsheet - week17.csv'));

  console.log(`CSV Week 16: ${csv16.length} rows, Week 17: ${csv17.length} rows`);
  console.log(dryRun ? '\n=== DRY RUN ===\n' : '\n=== IMPORTING ===\n');

  const pool = await new sql.ConnectionPool(dbConfig).connect();

  // Get all bowlers + alternate names
  const bowlersRes = await pool.request().query('SELECT bowlerID, bowlerName FROM bowlers');
  const dbBowlers = bowlersRes.recordset;
  const altNamesRes = await pool.request().query('SELECT bowlerID, alternateName FROM bowlerNameHistory');
  const altNames = altNamesRes.recordset;

  // Get team name history for season II
  const teamsRes = await pool.request().query(
    `SELECT tnh.teamID, tnh.teamName FROM teamNameHistory tnh WHERE tnh.seasonID = ${SEASON_ID}`
  );
  const seasonTeams = teamsRes.recordset;

  // Build team lookup (normalized name -> teamID)
  const teamLookup = {};
  for (const t of seasonTeams) {
    teamLookup[norm(t.teamName)] = t.teamID;
  }
  // Manual alias: CSV says "The Pinpricks", DB says "Pin Pricks"
  teamLookup[norm('The Pinpricks')] = teamLookup[norm('Pin Pricks')];

  // Build bowler lookup
  function findBowler(csvName) {
    const target = norm(csvName);

    // Exact match on bowlerName
    let match = dbBowlers.find(b => norm(b.bowlerName) === target);
    if (match) return match;

    // Check alternate names
    const alt = altNames.find(a => norm(a.alternateName) === target);
    if (alt) return dbBowlers.find(b => b.bowlerID === alt.bowlerID);

    // Last name + first name partial
    const parts = csvName.trim().split(/\s+/);
    if (parts.length >= 2) {
      const firstName = parts[0].toLowerCase();
      const lastName = parts[parts.length - 1].toLowerCase();
      match = dbBowlers.find(b => {
        const bParts = b.bowlerName.split(/\s+/);
        const bFirst = bParts[0]?.toLowerCase() ?? '';
        const bLast = bParts[bParts.length - 1]?.toLowerCase() ?? '';
        return bLast === lastName && bFirst.startsWith(firstName.substring(0, 3));
      });
      if (match) return match;
    }

    return null;
  }

  // Resolve all CSV rows
  function resolveRows(csvRows, week) {
    const resolved = [];
    const errors = [];
    for (const row of csvRows) {
      const bowler = findBowler(row.name);
      const teamID = teamLookup[norm(row.team)];

      if (!bowler) errors.push(`W${week}: No bowler match for "${row.name}" (${row.team})`);
      if (!teamID) errors.push(`W${week}: No team match for "${row.team}"`);

      resolved.push({
        ...row,
        bowlerID: bowler?.bowlerID ?? null,
        bowlerName: bowler?.bowlerName ?? row.name,
        teamID: teamID ?? null,
        week,
      });
    }
    return { resolved, errors };
  }

  const w16 = resolveRows(csv16, 16);
  const w17 = resolveRows(csv17, 17);
  const allErrors = [...w16.errors, ...w17.errors];

  if (allErrors.length > 0) {
    console.log('RESOLUTION ERRORS:');
    for (const e of allErrors) console.log(`  ${e}`);
    console.log('');
  }

  const allRows = [...w16.resolved, ...w17.resolved];

  // Show what we'll insert
  for (const week of [16, 17]) {
    const rows = allRows.filter(r => r.week === week);
    console.log(`--- Week ${week} (${rows.length} rows) ---`);
    for (const r of rows) {
      const status = r.bowlerID && r.teamID ? 'OK' : 'ERR';
      console.log(`  [${status}] ${r.team.padEnd(35)} ${r.name.padEnd(25)} → B:${r.bowlerID ?? '???'} T:${r.teamID ?? '???'}  ${r.g1}/${r.g2}/${r.g3}`);
    }
    console.log('');
  }

  // Check for unresolved
  const unresolved = allRows.filter(r => !r.bowlerID || !r.teamID);
  if (unresolved.length > 0) {
    console.log(`\nERROR: ${unresolved.length} unresolved rows. Fix before importing.`);
    await pool.close();
    process.exit(1);
  }

  if (dryRun) {
    console.log('Dry run complete. Remove --dry-run to execute.');
    await pool.close();
    return;
  }

  // Calculate incomingAvg for each bowler for each week
  async function getIncomingAvg(bowlerID, week) {
    const r = await pool.request().query(`
      SELECT TOP 1
        (SELECT AVG(CAST(g.val AS FLOAT))
         FROM (
           SELECT TOP 27 x2.val
           FROM scores s2
           CROSS APPLY (VALUES (s2.game1),(s2.game2),(s2.game3)) AS x2(val)
           WHERE s2.bowlerID = ${bowlerID} AND s2.isPenalty = 0 AND x2.val IS NOT NULL
             AND (s2.seasonID < ${SEASON_ID} OR (s2.seasonID = ${SEASON_ID} AND s2.week < ${week}))
           ORDER BY s2.seasonID DESC, s2.week DESC
         ) g
        ) AS avg27
    `);
    const avg = r.recordset[0]?.avg27;
    return avg != null ? Math.floor(avg) : null;
  }

  // Delete existing W16 and W17 scores
  const delResult16 = await pool.request().query(
    `DELETE FROM scores WHERE seasonID = ${SEASON_ID} AND week = 16`
  );
  console.log(`Deleted ${delResult16.rowsAffected[0]} existing W16 rows`);

  const delResult17 = await pool.request().query(
    `DELETE FROM scores WHERE seasonID = ${SEASON_ID} AND week = 17`
  );
  console.log(`Deleted ${delResult17.rowsAffected[0]} existing W17 rows`);

  // Insert week 16 first, then week 17 (so W17 incomingAvg can include W16 data)
  let inserted = 0;
  for (const week of [16, 17]) {
    const rows = allRows.filter(r => r.week === week);
    console.log(`\nInserting Week ${week}...`);

    for (const r of rows) {
      const incomingAvg = await getIncomingAvg(r.bowlerID, week);

      await pool.request()
        .input('bowlerID', sql.Int, r.bowlerID)
        .input('seasonID', sql.Int, SEASON_ID)
        .input('teamID', sql.Int, r.teamID)
        .input('week', sql.Int, week)
        .input('game1', sql.Int, r.g1)
        .input('game2', sql.Int, r.g2)
        .input('game3', sql.Int, r.g3)
        .input('incomingAvg', sql.Decimal(10, 0), incomingAvg)
        .input('turkeys', sql.Int, 0)
        .input('isPenalty', sql.Bit, 0)
        .query(`INSERT INTO scores (bowlerID, seasonID, teamID, week, game1, game2, game3, incomingAvg, turkeys, isPenalty)
                VALUES (@bowlerID, @seasonID, @teamID, @week, @game1, @game2, @game3, @incomingAvg, @turkeys, @isPenalty)`);
      inserted++;
    }
    console.log(`  Inserted ${rows.length} rows for Week ${week}`);
  }

  console.log(`\nTotal inserted: ${inserted} rows`);

  // Verify
  const verify = await pool.request().query(`
    SELECT week, COUNT(*) as cnt FROM scores WHERE seasonID = ${SEASON_ID} AND week IN (16, 17) GROUP BY week ORDER BY week
  `);
  console.log('\nVerification:', JSON.stringify(verify.recordset));

  await pool.close();

  console.log('\n=== POST-IMPORT STEPS ===');
  console.log('1. Regenerate match results: node scripts/populate-match-results.mjs --season=2');
  console.log('2. Regenerate patches: node scripts/populate-patches.mjs --season=2 --week=16 --week=17');
  console.log('3. Bump .data-versions.json for season 2 scores channel');
}

main().catch(e => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
