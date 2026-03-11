#!/usr/bin/env node
/**
 * Audit incomingAvg values across ALL bowlers.
 *
 * For each non-penalty score row, recomputes the 27-game rolling average
 * from prior games and compares to the stored incomingAvg. Flags rows where
 * the discrepancy exceeds a threshold.
 *
 * Also cross-references the stored incomingAvg against the handicap formula:
 *   hcp = FLOOR((225 - avg) * 0.95)
 * If avg > 225 or avg < 0, that's clearly wrong.
 *
 * Usage:
 *   node scripts/audit-averages.mjs                  # Full audit, threshold 3
 *   node scripts/audit-averages.mjs --threshold=5    # Only flag >= 5 pin diff
 *   node scripts/audit-averages.mjs --csv            # Output as CSV for review
 */
import sql from 'mssql';
import { readFileSync } from 'fs';

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
const thresholdArg = args.find(a => a.startsWith('--threshold='));
const threshold = thresholdArg ? parseFloat(thresholdArg.split('=')[1]) : 3;
const csvMode = args.includes('--csv');

async function main() {
  const pool = await sql.connect(config);

  console.error(`Fetching all score data...`);

  // Get all scores ordered by bowler, then chronologically
  const result = await pool.request().query(`
    SELECT
      sc.scoreID,
      sc.bowlerID,
      b.bowlerName,
      b.slug,
      b.establishedAvg,
      sc.seasonID,
      sn.displayName AS seasonName,
      sn.year,
      CASE sn.period WHEN 'Fall' THEN 2 ELSE 1 END AS periodOrd,
      sc.week,
      sc.game1, sc.game2, sc.game3,
      sc.incomingAvg,
      sc.isPenalty
    FROM scores sc
    JOIN seasons sn ON sc.seasonID = sn.seasonID
    JOIN bowlers b ON sc.bowlerID = b.bowlerID
    ORDER BY sc.bowlerID, sn.year, CASE sn.period WHEN 'Fall' THEN 2 ELSE 1 END, sc.week
  `);

  const rows = result.recordset;
  console.error(`Loaded ${rows.length} score rows. Processing...`);

  // Group by bowler
  const bowlerMap = new Map();
  for (const row of rows) {
    if (!bowlerMap.has(row.bowlerID)) {
      bowlerMap.set(row.bowlerID, []);
    }
    bowlerMap.get(row.bowlerID).push(row);
  }

  const flagged = [];

  for (const [bowlerID, bowlerRows] of bowlerMap) {
    // Build flat game list from non-penalty rows
    const allGames = []; // { scoreID, score }
    for (const row of bowlerRows) {
      if (row.isPenalty) continue;
      for (const key of ['game1', 'game2', 'game3']) {
        if (row[key] != null && row[key] > 0) {
          allGames.push({ scoreID: row.scoreID, score: row[key] });
        }
      }
    }

    // For each non-penalty row with incomingAvg, recompute
    for (const row of bowlerRows) {
      if (row.isPenalty) continue;
      if (row.incomingAvg == null) continue;

      const storedAvg = parseFloat(row.incomingAvg);

      // Find index of first game for this scoreID
      const firstIdx = allGames.findIndex(g => g.scoreID === row.scoreID);
      const prior = firstIdx > 0 ? allGames.slice(0, firstIdx) : [];
      const window = prior.slice(-27);
      const gameCount = window.length;

      let computedAvg = null;
      if (gameCount > 0) {
        const sum = window.reduce((s, g) => s + g.score, 0);
        computedAvg = Math.floor(sum / gameCount);
      } else if (row.establishedAvg != null) {
        computedAvg = row.establishedAvg;
      }

      // Check 1: avg out of sane range
      const impossibleAvg = storedAvg > 300 || storedAvg < 0;

      // Check 2: avg produces negative handicap (avg > 225 means negative hcp)
      const negativeHcp = storedAvg > 225;

      // Check 3: recomputed vs stored difference
      const diff = computedAvg != null ? storedAvg - computedAvg : null;
      const absDiff = diff != null ? Math.abs(diff) : null;

      // Determine if this is early career (few games, rounding expected)
      const isEarlyCareer = gameCount < 9; // less than 3 weeks of data

      // Flag conditions:
      // - Impossible avg (>300 or <0): always flag
      // - Negative handicap (>225): always flag
      // - Big diff from recomputed AND not early career: flag if >= threshold
      // - Big diff from recomputed AND early career: flag only if >= threshold * 3
      const earlyThreshold = threshold * 3;

      let reason = null;
      if (impossibleAvg) {
        reason = `impossible avg (${storedAvg})`;
      } else if (negativeHcp) {
        reason = `avg > 225 → negative hcp (avg=${storedAvg})`;
      } else if (absDiff != null && !isEarlyCareer && absDiff >= threshold) {
        reason = `diff ${diff > 0 ? '+' : ''}${diff.toFixed(1)} (stored=${storedAvg}, computed=${computedAvg}, ${gameCount} games)`;
      } else if (absDiff != null && isEarlyCareer && absDiff >= earlyThreshold) {
        reason = `early-career diff ${diff > 0 ? '+' : ''}${diff.toFixed(1)} (stored=${storedAvg}, computed=${computedAvg}, ${gameCount} games)`;
      }

      if (reason) {
        flagged.push({
          bowlerID,
          bowlerName: row.bowlerName,
          slug: row.slug,
          seasonName: row.seasonName,
          week: row.week,
          storedAvg,
          computedAvg,
          diff: absDiff,
          gameCount,
          game1: row.game1,
          game2: row.game2,
          game3: row.game3,
          reason,
          scoreID: row.scoreID,
        });
      }
    }
  }

  // Sort by severity (biggest diff first, then impossible values)
  flagged.sort((a, b) => (b.diff ?? 999) - (a.diff ?? 999));

  console.error(`\nFound ${flagged.length} flagged rows across ${new Set(flagged.map(f => f.bowlerID)).size} bowlers.\n`);

  if (csvMode) {
    console.log('scoreID,bowlerName,slug,season,week,storedAvg,computedAvg,diff,gameCount,game1,game2,game3,reason');
    for (const f of flagged) {
      console.log(`${f.scoreID},"${f.bowlerName}",${f.slug},${f.seasonName},${f.week},${f.storedAvg},${f.computedAvg ?? ''},${f.diff ?? ''},${f.gameCount},${f.game1 ?? ''},${f.game2 ?? ''},${f.game3 ?? ''},"${f.reason}"`);
    }
  } else {
    // Group by severity category
    const impossible = flagged.filter(f => f.reason.includes('impossible') || f.reason.includes('negative hcp'));
    const bigDiff = flagged.filter(f => !f.reason.includes('impossible') && !f.reason.includes('negative hcp') && (f.diff ?? 0) >= 10);
    const medDiff = flagged.filter(f => !f.reason.includes('impossible') && !f.reason.includes('negative hcp') && (f.diff ?? 0) >= threshold && (f.diff ?? 0) < 10);

    if (impossible.length > 0) {
      console.log('═══ IMPOSSIBLE VALUES (avg > 225 or out of range) ═══');
      console.log('Bowler                    Season                Wk  Stored  Computed  Games  Scores          Reason');
      console.log('------------------------  --------------------  --  ------  --------  -----  --------------  ------');
      for (const f of impossible) {
        const name = f.bowlerName.padEnd(24);
        const season = f.seasonName.padEnd(20);
        const wk = String(f.week).padStart(2);
        const stored = String(f.storedAvg).padStart(6);
        const computed = f.computedAvg != null ? String(f.computedAvg).padStart(8) : '     n/a';
        const games = String(f.gameCount).padStart(5);
        const scores = `${f.game1 ?? '-'}/${f.game2 ?? '-'}/${f.game3 ?? '-'}`.padEnd(14);
        console.log(`${name}  ${season}  ${wk}  ${stored}  ${computed}  ${games}  ${scores}  ${f.reason}`);
      }
      console.log();
    }

    if (bigDiff.length > 0) {
      console.log('═══ LARGE DISCREPANCIES (>= 10 pins from recomputed) ═══');
      console.log('Bowler                    Season                Wk  Stored  Computed  Diff    Games  Scores');
      console.log('------------------------  --------------------  --  ------  --------  ------  -----  --------------');
      for (const f of bigDiff) {
        const name = f.bowlerName.padEnd(24);
        const season = f.seasonName.padEnd(20);
        const wk = String(f.week).padStart(2);
        const stored = String(f.storedAvg).padStart(6);
        const computed = f.computedAvg != null ? String(f.computedAvg).padStart(8) : '     n/a';
        const diff = f.diff != null ? (f.storedAvg > f.computedAvg ? '+' : '-') + f.diff.toFixed(1) : 'n/a';
        const games = String(f.gameCount).padStart(5);
        const scores = `${f.game1 ?? '-'}/${f.game2 ?? '-'}/${f.game3 ?? '-'}`;
        console.log(`${name}  ${season}  ${wk}  ${stored}  ${computed}  ${diff.padStart(6)}  ${games}  ${scores}`);
      }
      console.log();
    }

    if (medDiff.length > 0) {
      console.log(`═══ MODERATE DISCREPANCIES (${threshold}-9 pins from recomputed) ═══`);
      console.log('Bowler                    Season                Wk  Stored  Computed  Diff    Games  Scores');
      console.log('------------------------  --------------------  --  ------  --------  ------  -----  --------------');
      for (const f of medDiff) {
        const name = f.bowlerName.padEnd(24);
        const season = f.seasonName.padEnd(20);
        const wk = String(f.week).padStart(2);
        const stored = String(f.storedAvg).padStart(6);
        const computed = f.computedAvg != null ? String(f.computedAvg).padStart(8) : '     n/a';
        const diff = f.diff != null ? (f.storedAvg > f.computedAvg ? '+' : '-') + f.diff.toFixed(1) : 'n/a';
        const games = String(f.gameCount).padStart(5);
        const scores = `${f.game1 ?? '-'}/${f.game2 ?? '-'}/${f.game3 ?? '-'}`;
        console.log(`${name}  ${season}  ${wk}  ${stored}  ${computed}  ${diff.padStart(6)}  ${games}  ${scores}`);
      }
      console.log();
    }

    // Summary
    console.log('═══ SUMMARY ═══');
    console.log(`Total score rows analyzed: ${rows.filter(r => !r.isPenalty && r.incomingAvg != null).length}`);
    console.log(`Impossible values:        ${impossible.length}`);
    console.log(`Large discrepancies (10+): ${bigDiff.length}`);
    console.log(`Moderate discrepancies:    ${medDiff.length}`);
    console.log(`Total flagged:            ${flagged.length}`);
  }

  await pool.close();
}

main().catch(err => { console.error(err); process.exit(1); });
