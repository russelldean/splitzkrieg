#!/usr/bin/env node
/**
 * Detect and record career milestones achieved in a specific week.
 *
 * Compares each bowler's cumulative stats through this week vs. prior week
 * against the milestone thresholds, and inserts any newly crossed thresholds
 * into the bowlerMilestones table.
 *
 * Usage:
 *   node scripts/record-milestones.mjs --season=35 --week=4
 *   node scripts/record-milestones.mjs --season=35 --week=4 --dry-run
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

// Parse args
const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? 'true'];
  })
);

const seasonID = parseInt(args.season, 10);
const week = parseInt(args.week, 10);
const dryRun = args['dry-run'] === 'true';

if (!seasonID || !week) {
  console.error('Usage: node scripts/record-milestones.mjs --season=35 --week=4 [--dry-run]');
  process.exit(1);
}

// Milestone thresholds — must match src/lib/milestone-config.ts
const THRESHOLDS = {
  totalGames:    { label: 'Career Games',   thresholds: [100, 250, 500, 750, 1000] },
  totalPins:     { label: 'Career Pins',    thresholds: [10_000, 25_000, 50_000, 75_000, 100_000, 150_000, 200_000] },
  games200Plus:  { label: '200+ Games',     thresholds: [10, 25, 50, 75, 100, 150, 200, 250, 300] },
  series600Plus: { label: '600+ Series',    thresholds: [10, 25, 50, 75, 100] },
  totalTurkeys:  { label: 'Career Turkeys', thresholds: [25, 50, 100, 150, 200, 250, 300, 350, 400] },
};

const STATS_SQL = `
  SELECT
    sc.bowlerID,
    b.bowlerName,
    COUNT(*) * 3 AS totalGamesBowled,
    SUM(sc.scratchSeries) AS totalPins,
    SUM(CASE WHEN sc.game1 >= 200 THEN 1 ELSE 0 END
      + CASE WHEN sc.game2 >= 200 THEN 1 ELSE 0 END
      + CASE WHEN sc.game3 >= 200 THEN 1 ELSE 0 END) AS games200Plus,
    SUM(CASE WHEN sc.scratchSeries >= 600 THEN 1 ELSE 0 END) AS series600Plus,
    SUM(ISNULL(sc.turkeys, 0)) AS totalTurkeys
  FROM scores sc
  JOIN bowlers b ON sc.bowlerID = b.bowlerID
  WHERE sc.isPenalty = 0
    AND (sc.seasonID < @seasonID OR (sc.seasonID = @seasonID AND sc.week <= @week))
  GROUP BY sc.bowlerID, b.bowlerName
`;

const CONTRIB_SQL = `
  SELECT
    sc.bowlerID,
    3 AS gamesAdded,
    sc.scratchSeries AS pinsAdded,
    (CASE WHEN sc.game1 >= 200 THEN 1 ELSE 0 END
     + CASE WHEN sc.game2 >= 200 THEN 1 ELSE 0 END
     + CASE WHEN sc.game3 >= 200 THEN 1 ELSE 0 END) AS g200Added,
    CASE WHEN sc.scratchSeries >= 600 THEN 1 ELSE 0 END AS s600Added,
    ISNULL(sc.turkeys, 0) AS turkeysAdded
  FROM scores sc
  WHERE sc.seasonID = @seasonID AND sc.week = @week AND sc.isPenalty = 0
`;

const STAT_KEYS = {
  totalGames: 'totalGamesBowled',
  totalPins: 'totalPins',
  games200Plus: 'games200Plus',
  series600Plus: 'series600Plus',
  totalTurkeys: 'totalTurkeys',
};

const CONTRIB_KEYS = {
  totalGames: 'gamesAdded',
  totalPins: 'pinsAdded',
  games200Plus: 'g200Added',
  series600Plus: 's600Added',
  totalTurkeys: 'turkeysAdded',
};

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

async function main() {
  const pool = await new sql.ConnectionPool(dbConfig).connect();

  console.log(`Detecting milestones for Season ${seasonID} Week ${week}${dryRun ? ' (DRY RUN)' : ''}...`);

  // Get cumulative stats through this week
  const statsRes = await pool.request()
    .input('seasonID', sql.Int, seasonID)
    .input('week', sql.Int, week)
    .query(STATS_SQL);

  // Get this week's contributions
  const contribRes = await pool.request()
    .input('seasonID', sql.Int, seasonID)
    .input('week', sql.Int, week)
    .query(CONTRIB_SQL);

  const contribMap = new Map(contribRes.recordset.map(c => [c.bowlerID, c]));

  // Check existing milestones to avoid duplicates
  const existingRes = await pool.request()
    .query('SELECT bowlerID, category, threshold FROM bowlerMilestones');
  const existingSet = new Set(
    existingRes.recordset.map(r => `${r.bowlerID}-${r.category}-${r.threshold}`)
  );

  const achieved = [];

  for (const bowler of statsRes.recordset) {
    const contrib = contribMap.get(bowler.bowlerID);

    for (const [category, config] of Object.entries(THRESHOLDS)) {
      const current = bowler[STAT_KEYS[category]];
      const weekAdded = contrib ? contrib[CONTRIB_KEYS[category]] : 0;
      const prior = current - weekAdded;

      for (const threshold of config.thresholds) {
        if (current >= threshold && prior < threshold) {
          const key = `${bowler.bowlerID}-${category}-${threshold}`;
          if (!existingSet.has(key)) {
            achieved.push({
              bowlerID: bowler.bowlerID,
              bowlerName: bowler.bowlerName,
              category,
              label: config.label,
              threshold,
              current,
            });
          }
        }
      }
    }
  }

  if (achieved.length === 0) {
    console.log('No new milestones this week.');
    await pool.close();
    return;
  }

  console.log(`\nFound ${achieved.length} milestone(s):`);
  for (const m of achieved) {
    console.log(`  ${m.bowlerName}: ${m.threshold.toLocaleString()} ${m.label} (now at ${m.current.toLocaleString()})`);
  }

  if (!dryRun) {
    console.log('\nInserting into bowlerMilestones...');
    for (const m of achieved) {
      await pool.request()
        .input('bowlerID', sql.Int, m.bowlerID)
        .input('category', sql.VarChar(30), m.category)
        .input('threshold', sql.Int, m.threshold)
        .input('seasonID', sql.Int, seasonID)
        .input('week', sql.Int, week)
        .query(`
          INSERT INTO bowlerMilestones (bowlerID, category, threshold, seasonID, week)
          VALUES (@bowlerID, @category, @threshold, @seasonID, @week)
        `);
    }
    console.log(`Inserted ${achieved.length} row(s).`);
  } else {
    console.log('\nDry run — no rows inserted.');
  }

  await pool.close();
  console.log('Done.');
}

main().catch(e => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
