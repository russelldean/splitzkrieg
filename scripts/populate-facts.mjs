#!/usr/bin/env node
/**
 * Populate the facts table with personal record progressions and milestones.
 *
 * Incremental by default — only inserts new facts and updates isCareerHigh flags.
 *
 * Usage:
 *   node scripts/populate-facts.mjs --season=35 --week=6   # process one week (after score import)
 *   node scripts/populate-facts.mjs                         # scan for any missing facts
 *   node scripts/populate-facts.mjs --wipe                  # wipe and repopulate all
 *   node scripts/populate-facts.mjs --dry-run               # preview without writing
 *   node scripts/populate-facts.mjs --wipe --type=high-game
 */

import sql from 'mssql';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const envContent = readFileSync(path.join(ROOT, '.env.local'), 'utf8');
for (const line of envContent.split('\n')) {
  const match = line.match(/^([A-Z_]+)=(.*)$/);
  if (match) process.env[match[1]] = match[2].trim();
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
    requestTimeout: 120000,
  },
};

async function main() {
  const pool = await new sql.ConnectionPool(dbConfig).connect();
  const dryRun = process.argv.includes('--dry-run');
  const wipe = process.argv.includes('--wipe');
  const typeArg = process.argv.find(a => a.startsWith('--type='));
  const targetType = typeArg ? typeArg.split('=')[1] : null;
  const seasonArg = process.argv.find(a => a.startsWith('--season='));
  const weekArg = process.argv.find(a => a.startsWith('--week='));
  const targetSeasonID = seasonArg ? parseInt(seasonArg.split('=')[1]) : null;
  const targetWeek = weekArg ? parseInt(weekArg.split('=')[1]) : null;

  if (targetWeek && !targetSeasonID) {
    console.error('ERROR: --week requires --season');
    process.exit(1);
  }

  const scopeLabel = targetSeasonID
    ? `season ${targetSeasonID}${targetWeek ? ` week ${targetWeek}` : ''}`
    : 'all seasons';
  console.log(dryRun ? '=== DRY RUN ===' : '=== POPULATING facts ===');
  console.log(`Scope: ${scopeLabel}`);

  // Load fact type IDs
  const factTypeRows = (await pool.request().query('SELECT factTypeID, code FROM factTypes')).recordset;
  const factTypeMap = new Map(factTypeRows.map(ft => [ft.code, ft.factTypeID]));
  console.log(`Fact types: ${factTypeRows.map(ft => `${ft.code}(${ft.factTypeID})`).join(', ')}`);

  // Wipe if requested
  if (wipe && !dryRun) {
    const req = pool.request();
    let wipeSQL = 'DELETE FROM facts WHERE 1=1';
    if (targetType) {
      const ftID = factTypeMap.get(targetType);
      if (!ftID) { console.error(`Unknown fact type: ${targetType}`); process.exit(1); }
      req.input('ftID', sql.Int, ftID);
      wipeSQL += ' AND factTypeID = @ftID';
    }
    const del = await req.query(wipeSQL);
    console.log(`Wiped ${del.rowsAffected[0]} rows${targetType ? ` for type "${targetType}"` : ''}`);
  }

  let totalInserted = 0;

  // --- HIGH GAME PROGRESSION ---
  if (!targetType || targetType === 'high-game') {
    const factTypeID = factTypeMap.get('high-game');
    console.log('\n--- High Game Progressions ---');

    // Even when scoped to one week, we need the full running max to know if
    // this week's best game beats all prior weeks. But we only INSERT for the target week.
    const gameRows = (await pool.request().query(`
      WITH weekBest AS (
        SELECT s.bowlerID, s.seasonID, s.week,
          (SELECT TOP 1 sc.matchDate FROM schedule sc WHERE sc.seasonID = s.seasonID AND sc.week = s.week) AS matchDate,
          GREATEST(s.game1, s.game2, s.game3) AS bestGame
        FROM scores s
        WHERE s.isPenalty = 0
          ${targetSeasonID ? `AND s.bowlerID IN (SELECT bowlerID FROM scores WHERE seasonID = ${parseInt(targetSeasonID)}${targetWeek ? ` AND week = ${parseInt(targetWeek)}` : ''} AND isPenalty = 0)` : ''}
      ),
      ordered AS (
        SELECT *,
          MAX(bestGame) OVER (
            PARTITION BY bowlerID
            ORDER BY seasonID, week
            ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
          ) AS prevBest
        FROM weekBest
      )
      SELECT bowlerID, seasonID, week, matchDate, bestGame, prevBest
      FROM ordered
      WHERE bestGame >= prevBest AND prevBest IS NOT NULL
        ${targetSeasonID ? `AND seasonID = ${parseInt(targetSeasonID)}` : ''}
        ${targetWeek ? `AND week = ${parseInt(targetWeek)}` : ''}
      ORDER BY bowlerID, seasonID, week
    `)).recordset;

    console.log(`Found ${gameRows.length} high game progressions`);

    // Check existing to avoid duplicates
    const existing = new Set();
    if (!wipe) {
      const existingRows = (await pool.request()
        .input('ftID', sql.Int, factTypeID)
        .query('SELECT bowlerID, seasonID, week FROM facts WHERE factTypeID = @ftID')
      ).recordset;
      for (const r of existingRows) existing.add(`${r.bowlerID}-${r.seasonID}-${r.week}`);
    }

    let inserted = 0;
    for (const r of gameRows) {
      const key = `${r.bowlerID}-${r.seasonID}-${r.week}`;
      if (existing.has(key)) continue;

      if (!dryRun) {
        await pool.request()
          .input('factTypeID', sql.Int, factTypeID)
          .input('bowlerID', sql.Int, r.bowlerID)
          .input('seasonID', sql.Int, r.seasonID)
          .input('week', sql.Int, r.week)
          .input('referenceDate', sql.Date, r.matchDate)
          .input('value', sql.Int, r.bestGame)
          .input('previousValue', sql.Int, r.prevBest)
          .query('INSERT INTO facts (factTypeID, bowlerID, seasonID, week, referenceDate, value, previousValue) VALUES (@factTypeID, @bowlerID, @seasonID, @week, @referenceDate, @value, @previousValue)');
      }
      inserted++;
    }

    console.log(`${dryRun ? 'Would insert' : 'Inserted'} ${inserted} high game facts`);
    totalInserted += inserted;
  }

  // --- HIGH SERIES PROGRESSION ---
  if (!targetType || targetType === 'high-series') {
    const factTypeID = factTypeMap.get('high-series');
    console.log('\n--- High Series Progressions ---');

    const seriesRows = (await pool.request().query(`
      WITH weekSeries AS (
        SELECT s.bowlerID, s.seasonID, s.week,
          (SELECT TOP 1 sc.matchDate FROM schedule sc WHERE sc.seasonID = s.seasonID AND sc.week = s.week) AS matchDate,
          s.scratchSeries
        FROM scores s
        WHERE s.isPenalty = 0 AND s.scratchSeries IS NOT NULL
          ${targetSeasonID ? `AND s.bowlerID IN (SELECT bowlerID FROM scores WHERE seasonID = ${parseInt(targetSeasonID)}${targetWeek ? ` AND week = ${parseInt(targetWeek)}` : ''} AND isPenalty = 0)` : ''}
      ),
      ordered AS (
        SELECT *,
          MAX(scratchSeries) OVER (
            PARTITION BY bowlerID
            ORDER BY seasonID, week
            ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
          ) AS prevBest
        FROM weekSeries
      )
      SELECT bowlerID, seasonID, week, matchDate, scratchSeries, prevBest
      FROM ordered
      WHERE scratchSeries >= prevBest AND prevBest IS NOT NULL
        ${targetSeasonID ? `AND seasonID = ${parseInt(targetSeasonID)}` : ''}
        ${targetWeek ? `AND week = ${parseInt(targetWeek)}` : ''}
      ORDER BY bowlerID, seasonID, week
    `)).recordset;

    console.log(`Found ${seriesRows.length} high series progressions`);

    const existing = new Set();
    if (!wipe) {
      const existingRows = (await pool.request()
        .input('ftID', sql.Int, factTypeID)
        .query('SELECT bowlerID, seasonID, week FROM facts WHERE factTypeID = @ftID')
      ).recordset;
      for (const r of existingRows) existing.add(`${r.bowlerID}-${r.seasonID}-${r.week}`);
    }

    let inserted = 0;
    for (const r of seriesRows) {
      const key = `${r.bowlerID}-${r.seasonID}-${r.week}`;
      if (existing.has(key)) continue;

      if (!dryRun) {
        await pool.request()
          .input('factTypeID', sql.Int, factTypeID)
          .input('bowlerID', sql.Int, r.bowlerID)
          .input('seasonID', sql.Int, r.seasonID)
          .input('week', sql.Int, r.week)
          .input('referenceDate', sql.Date, r.matchDate)
          .input('value', sql.Int, r.scratchSeries)
          .input('previousValue', sql.Int, r.prevBest)
          .query('INSERT INTO facts (factTypeID, bowlerID, seasonID, week, referenceDate, value, previousValue) VALUES (@factTypeID, @bowlerID, @seasonID, @week, @referenceDate, @value, @previousValue)');
      }
      inserted++;
    }

    console.log(`${dryRun ? 'Would insert' : 'Inserted'} ${inserted} high series facts`);
    totalInserted += inserted;
  }

  // --- MILESTONES ---
  if (!targetType || targetType === 'milestone') {
    const factTypeID = factTypeMap.get('milestone');
    console.log('\n--- Career Milestones ---');

    let milestoneFilter = '';
    if (targetSeasonID) {
      milestoneFilter += ` AND bm.seasonID = ${parseInt(targetSeasonID)}`;
    }
    if (targetWeek) {
      milestoneFilter += ` AND bm.week = ${parseInt(targetWeek)}`;
    }

    const milestoneRows = (await pool.request().query(`
      SELECT bm.bowlerID, bm.seasonID, bm.week, bm.threshold,
        (SELECT TOP 1 sc.matchDate FROM schedule sc WHERE sc.seasonID = bm.seasonID AND sc.week = bm.week) AS matchDate
      FROM bowlerMilestones bm
      WHERE 1=1 ${milestoneFilter}
      ORDER BY bm.seasonID, bm.week
    `)).recordset;

    console.log(`Found ${milestoneRows.length} milestones`);

    const existing = new Set();
    if (!wipe) {
      const existingRows = (await pool.request()
        .input('ftID', sql.Int, factTypeID)
        .query('SELECT bowlerID, seasonID, week, value FROM facts WHERE factTypeID = @ftID')
      ).recordset;
      for (const r of existingRows) existing.add(`${r.bowlerID}-${r.value}-${r.seasonID}-${r.week}`);
    }

    let inserted = 0;
    for (const m of milestoneRows) {
      const key = `${m.bowlerID}-${m.threshold}-${m.seasonID}-${m.week}`;
      if (existing.has(key)) continue;

      if (!dryRun) {
        await pool.request()
          .input('factTypeID', sql.Int, factTypeID)
          .input('bowlerID', sql.Int, m.bowlerID)
          .input('seasonID', sql.Int, m.seasonID)
          .input('week', sql.Int, m.week)
          .input('referenceDate', sql.Date, m.matchDate)
          .input('value', sql.Int, m.threshold)
          .query('INSERT INTO facts (factTypeID, bowlerID, seasonID, week, referenceDate, value) VALUES (@factTypeID, @bowlerID, @seasonID, @week, @referenceDate, @value)');
      }
      inserted++;
    }

    console.log(`${dryRun ? 'Would insert' : 'Inserted'} ${inserted} milestone facts`);
    totalInserted += inserted;
  }

  // --- UPDATE isCareerHigh FLAGS ---
  // For types 1 & 2, the fact with the highest value per bowler is their career high.
  // Reset all then set the correct ones.
  if (!dryRun) {
    console.log('\n--- Updating isCareerHigh flags ---');

    // Only update for bowlers who bowled this week (if scoped), otherwise all
    let bowlerScope = '';
    if (targetSeasonID && targetWeek) {
      bowlerScope = `AND f.bowlerID IN (SELECT bowlerID FROM scores WHERE seasonID = ${parseInt(targetSeasonID)} AND week = ${parseInt(targetWeek)} AND isPenalty = 0)`;
    }

    // Clear existing flags (scoped to affected bowlers)
    const cleared = await pool.request().query(`
      UPDATE facts SET isCareerHigh = 0
      WHERE factTypeID IN (1, 2) AND isCareerHigh = 1 ${bowlerScope}
    `);
    console.log(`Cleared ${cleared.rowsAffected[0]} old career high flags`);

    // Set new flags: highest value per bowler per factType wins
    const set = await pool.request().query(`
      WITH ranked AS (
        SELECT factID,
          ROW_NUMBER() OVER (
            PARTITION BY factTypeID, bowlerID
            ORDER BY value DESC, seasonID DESC, week DESC
          ) AS rn
        FROM facts
        WHERE factTypeID IN (1, 2) ${bowlerScope}
      )
      UPDATE f SET f.isCareerHigh = 1
      FROM facts f JOIN ranked r ON r.factID = f.factID
      WHERE r.rn = 1
    `);
    console.log(`Set ${set.rowsAffected[0]} career high flags`);
  }

  console.log(`\n=== Total: ${totalInserted} facts ${dryRun ? 'would be' : ''} inserted ===`);

  if (!dryRun) {
    const count = await pool.request().query('SELECT COUNT(*) AS cnt FROM facts');
    const careerHighs = await pool.request().query('SELECT COUNT(*) AS cnt FROM facts WHERE isCareerHigh = 1');
    console.log(`Facts table: ${count.recordset[0].cnt} total, ${careerHighs.recordset[0].cnt} career highs`);
  }

  await pool.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
