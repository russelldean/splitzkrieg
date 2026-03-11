#!/usr/bin/env node
/**
 * Verify rolling average data for bowler charts.
 *
 * Modes:
 *   node scripts/verify-rolling-avg.mjs --swings          Find biggest week-over-week swings (default)
 *   node scripts/verify-rolling-avg.mjs --bowler=<slug>   Verify a specific bowler's incomingAvg vs recomputed
 *   node scripts/verify-rolling-avg.mjs --bowler=<slug> --detail   Show full game-by-game breakdown
 *
 * Options:
 *   --top=N       Number of results to show (default 30)
 *   --min-swing=N Minimum swing to report in points (default 5)
 */
import sql from 'mssql';
import { readFileSync } from 'fs';

// Load .env.local
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
  options: { encrypt: true, trustServerCertificate: false, connectTimeout: 120000, requestTimeout: 120000 },
};

const args = process.argv.slice(2);
const bowlerArg = args.find(a => a.startsWith('--bowler='));
const bowlerSlug = bowlerArg ? bowlerArg.split('=')[1] : null;
const detail = args.includes('--detail');
const topArg = args.find(a => a.startsWith('--top='));
const top = topArg ? parseInt(topArg.split('=')[1]) : 30;
const minSwingArg = args.find(a => a.startsWith('--min-swing='));
const minSwing = minSwingArg ? parseFloat(minSwingArg.split('=')[1]) : 5;

async function main() {
  const pool = await sql.connect(config);

  if (bowlerSlug) {
    await verifyBowler(pool, bowlerSlug);
  } else {
    await findBiggestSwings(pool);
  }

  await pool.close();
}

/**
 * Find bowlers with the biggest week-over-week incomingAvg swings.
 */
async function findBiggestSwings(pool) {
  console.log(`Finding biggest week-over-week rolling avg swings (min ${minSwing} pts)...\n`);

  const result = await pool.request().query(`
    WITH ordered AS (
      SELECT
        sc.bowlerID,
        b.bowlerName,
        b.slug,
        sn.displayName AS seasonName,
        sc.week,
        sc.incomingAvg,
        LAG(sc.incomingAvg) OVER (
          PARTITION BY sc.bowlerID
          ORDER BY sn.year, CASE sn.period WHEN 'Fall' THEN 2 ELSE 1 END, sc.week
        ) AS prevAvg,
        LAG(sn.displayName) OVER (
          PARTITION BY sc.bowlerID
          ORDER BY sn.year, CASE sn.period WHEN 'Fall' THEN 2 ELSE 1 END, sc.week
        ) AS prevSeasonName,
        LAG(sc.week) OVER (
          PARTITION BY sc.bowlerID
          ORDER BY sn.year, CASE sn.period WHEN 'Fall' THEN 2 ELSE 1 END, sc.week
        ) AS prevWeek
      FROM scores sc
      JOIN seasons sn ON sc.seasonID = sn.seasonID
      JOIN bowlers b ON sc.bowlerID = b.bowlerID
      WHERE sc.isPenalty = 0
        AND sc.incomingAvg IS NOT NULL
    )
    SELECT TOP ${top}
      bowlerID,
      bowlerName,
      slug,
      prevSeasonName,
      prevWeek,
      prevAvg,
      seasonName,
      week,
      incomingAvg,
      ABS(incomingAvg - prevAvg) AS swing
    FROM ordered
    WHERE prevAvg IS NOT NULL
      AND ABS(incomingAvg - prevAvg) >= ${minSwing}
    ORDER BY ABS(incomingAvg - prevAvg) DESC
  `);

  if (result.recordset.length === 0) {
    console.log(`No swings >= ${minSwing} points found.`);
    return;
  }

  console.log('Rank  Swing  Bowler                    From                          To                            Avg Change');
  console.log('----  -----  ------------------------  ----------------------------  ----------------------------  ----------');

  for (let i = 0; i < result.recordset.length; i++) {
    const r = result.recordset[i];
    const rank = String(i + 1).padStart(4);
    const swing = r.swing.toFixed(1).padStart(5);
    const name = r.bowlerName.padEnd(24);
    const from = `${r.prevSeasonName} Wk ${r.prevWeek}`.padEnd(28);
    const to = `${r.seasonName} Wk ${r.week}`.padEnd(28);
    const direction = r.incomingAvg > r.prevAvg ? '+' : '-';
    const change = `${direction}${r.swing.toFixed(1)}  (${r.prevAvg.toFixed(1)} → ${r.incomingAvg.toFixed(1)})`;
    console.log(`${rank}  ${swing}  ${name}  ${from}  ${to}  ${change}`);
  }

  // Also show unique bowler summary
  const bowlerSwings = new Map();
  for (const r of result.recordset) {
    if (!bowlerSwings.has(r.bowlerName)) {
      bowlerSwings.set(r.bowlerName, { count: 0, maxSwing: 0, slug: r.slug });
    }
    const entry = bowlerSwings.get(r.bowlerName);
    entry.count++;
    entry.maxSwing = Math.max(entry.maxSwing, r.swing);
  }

  console.log(`\n\nBowlers with swings >= ${minSwing} pts (${bowlerSwings.size} unique):`);
  console.log('Bowler                    Slug                          Occurrences  Max Swing');
  console.log('------------------------  ----------------------------  -----------  ---------');
  const sorted = [...bowlerSwings.entries()].sort((a, b) => b[1].maxSwing - a[1].maxSwing);
  for (const [name, data] of sorted) {
    console.log(`${name.padEnd(24)}  ${data.slug.padEnd(28)}  ${String(data.count).padStart(11)}  ${data.maxSwing.toFixed(1).padStart(9)}`);
  }
}

/**
 * Verify a specific bowler: recompute 27-game rolling avg and compare to stored incomingAvg.
 */
async function verifyBowler(pool, slug) {
  // Resolve slug to bowlerID
  const bowlerResult = await pool.request()
    .input('slug', slug)
    .query(`SELECT bowlerID, bowlerName, establishedAvg FROM bowlers WHERE slug = @slug`);

  if (bowlerResult.recordset.length === 0) {
    console.error(`No bowler found with slug: ${slug}`);
    process.exit(1);
  }

  const { bowlerID, bowlerName, establishedAvg } = bowlerResult.recordset[0];
  console.log(`Verifying: ${bowlerName} (ID ${bowlerID}, established avg: ${establishedAvg ?? 'none'})\n`);

  // Get all individual games in chronological order
  const gamesResult = await pool.request()
    .input('bowlerID', bowlerID)
    .query(`
      SELECT
        sc.scoreID,
        sc.seasonID,
        sn.displayName,
        sc.week,
        sc.game1, sc.game2, sc.game3,
        sc.incomingAvg,
        sc.isPenalty
      FROM scores sc
      JOIN seasons sn ON sc.seasonID = sn.seasonID
      WHERE sc.bowlerID = @bowlerID
      ORDER BY sn.year ASC,
               CASE sn.period WHEN 'Fall' THEN 2 ELSE 1 END ASC,
               sc.week ASC
    `);

  const rows = gamesResult.recordset;

  // Build flat game list (individual games, not weeks) for rolling avg calc
  // Only non-penalty, non-null, non-zero games
  const allGames = []; // { seasonName, week, gameNum, score }
  for (const row of rows) {
    if (row.isPenalty) continue;
    for (const [gameNum, key] of [[1, 'game1'], [2, 'game2'], [3, 'game3']]) {
      if (row[key] != null && row[key] > 0) {
        allGames.push({
          scoreID: row.scoreID,
          seasonName: row.displayName,
          week: row.week,
          gameNum,
          score: row[key],
        });
      }
    }
  }

  // For each non-penalty week, compute what the rolling avg SHOULD have been
  // incomingAvg = avg of up to 27 games PRIOR to that week
  let gameIndex = 0;
  const weekRows = rows.filter(r => !r.isPenalty && r.incomingAvg != null);
  let mismatches = 0;

  if (detail) {
    console.log('Season                  Wk  Stored   Computed  Diff   Games  Window');
    console.log('----------------------  --  -------  --------  -----  -----  ------');
  }

  for (const row of rows) {
    if (row.isPenalty) continue;

    // Find all games BEFORE this week
    const priorGames = allGames.filter(g => {
      if (g.scoreID < row.scoreID) return true;
      // Same scoreID means same week — exclude
      return false;
    });

    // Actually we need chronological ordering, not scoreID ordering.
    // Let's use the flat game list position approach instead.
    // Games for this row start at the current position in allGames
    // Prior games are everything before this row's games
    const thisWeekGames = allGames.filter(g => g.scoreID === row.scoreID);
    const thisWeekFirstIdx = allGames.findIndex(g => g.scoreID === row.scoreID);

    const prior = thisWeekFirstIdx > 0 ? allGames.slice(0, thisWeekFirstIdx) : [];
    const window = prior.slice(-27);

    let computedAvg = null;
    if (window.length > 0) {
      const sum = window.reduce((s, g) => s + g.score, 0);
      computedAvg = Math.floor(sum / window.length);
    } else if (establishedAvg != null) {
      computedAvg = establishedAvg;
    }

    const storedAvg = row.incomingAvg != null ? parseFloat(row.incomingAvg) : null;
    const diff = storedAvg != null && computedAvg != null ? storedAvg - computedAvg : null;
    const isMismatch = diff != null && Math.abs(diff) >= 1;

    if (isMismatch) mismatches++;

    if (detail || (isMismatch && !detail)) {
      const season = (row.displayName || '').padEnd(22);
      const wk = String(row.week).padStart(2);
      const stored = storedAvg != null ? storedAvg.toFixed(1).padStart(7) : '   null';
      const computed = computedAvg != null ? String(computedAvg).padStart(8) : '    null';
      const diffStr = diff != null ? (diff >= 0 ? '+' : '') + diff.toFixed(1) : '  n/a';
      const games = String(window.length).padStart(5);
      const windowRange = window.length > 0
        ? `${window[0].seasonName} W${window[0].week}G${window[0].gameNum} → ${window[window.length-1].seasonName} W${window[window.length-1].week}G${window[window.length-1].gameNum}`
        : 'n/a';

      if (!detail && isMismatch) {
        // Print header once
        if (mismatches === 1) {
          console.log('Mismatches (stored vs recomputed, diff >= 1 pin):');
          console.log('Season                  Wk  Stored   Computed  Diff   Games  Window');
          console.log('----------------------  --  -------  --------  -----  -----  ------');
        }
      }
      console.log(`${season}  ${wk}  ${stored}  ${computed}  ${diffStr.padStart(5)}  ${games}  ${windowRange}`);
    }
  }

  console.log(`\nTotal weeks checked: ${rows.filter(r => !r.isPenalty).length}`);
  console.log(`Mismatches (>= 1 pin): ${mismatches}`);
  if (mismatches === 0) {
    console.log('✓ All stored incomingAvg values match recomputed rolling averages.');
  }
}

main().catch(err => { console.error(err); process.exit(1); });
