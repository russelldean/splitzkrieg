#!/usr/bin/env node
/**
 * Analyze discrepancy context — for each flagged row (2+ pins off),
 * check the weeks before and after to determine if it's:
 *   - ONE-OFF: surrounding weeks are within 1 pin (blip in one week)
 *   - ONSET: starts accurate, then goes off (something broke)
 *   - RECOVERY: was off, then comes back (corrected itself)
 *   - SUSTAINED: off for multiple consecutive weeks (persistent error)
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

async function main() {
  const pool = await sql.connect(config);

  const result = await pool.request().query(`
    SELECT
      sc.scoreID, sc.bowlerID, b.bowlerName, b.slug, b.establishedAvg,
      sc.seasonID, sn.displayName AS seasonName, sn.year,
      CASE sn.period WHEN 'Fall' THEN 2 ELSE 1 END AS periodOrd,
      sc.week, sc.game1, sc.game2, sc.game3, sc.incomingAvg, sc.isPenalty
    FROM scores sc
    JOIN seasons sn ON sc.seasonID = sn.seasonID
    JOIN bowlers b ON sc.bowlerID = b.bowlerID
    ORDER BY sc.bowlerID, sn.year, CASE sn.period WHEN 'Fall' THEN 2 ELSE 1 END, sc.week
  `);

  const rows = result.recordset;
  await pool.close();

  // Build excluded season IDs
  const excludedSeasonIDs = new Set();
  const excludedBowlerSlugs = new Set(['denis-webb']);
  for (const row of rows) {
    if (
      (row.year === 2007 && row.periodOrd === 1) ||
      (row.year === 2008 && row.periodOrd === 2) ||
      (row.year === 2009 && row.periodOrd === 1)
    ) {
      excludedSeasonIDs.add(row.seasonID);
    }
  }

  // Group by bowler
  const bowlerMap = new Map();
  for (const row of rows) {
    if (!bowlerMap.has(row.bowlerID)) bowlerMap.set(row.bowlerID, []);
    bowlerMap.get(row.bowlerID).push(row);
  }

  // For each bowler, compute diffs for ALL weeks, then classify patterns
  const patterns = { oneOff: [], sustained: [] };

  for (const [bowlerID, bowlerRows] of bowlerMap) {
    if (excludedBowlerSlugs.has(bowlerRows[0]?.slug)) continue;

    // Build game list
    const allGames = [];
    for (const row of bowlerRows) {
      if (row.isPenalty) continue;
      for (const key of ['game1', 'game2', 'game3']) {
        if (row[key] != null && row[key] > 0) {
          allGames.push({ scoreID: row.scoreID, score: row[key] });
        }
      }
    }

    // Compute diff for every non-penalty row
    const weekDiffs = [];
    for (const row of bowlerRows) {
      if (row.isPenalty || row.incomingAvg == null) {
        weekDiffs.push({ row, diff: null, gameCount: 0 });
        continue;
      }
      const firstIdx = allGames.findIndex(g => g.scoreID === row.scoreID);
      const prior = firstIdx > 0 ? allGames.slice(0, firstIdx) : [];
      const window = prior.slice(-27);
      const gameCount = window.length;

      let computedAvg = null;
      if (gameCount > 0) {
        computedAvg = Math.floor(window.reduce((s, g) => s + g.score, 0) / gameCount);
      }

      const stored = parseFloat(row.incomingAvg);
      const diff = computedAvg != null ? stored - computedAvg : null;
      weekDiffs.push({ row, diff, absDiff: diff != null ? Math.abs(diff) : null, computedAvg, stored, gameCount });
    }

    // Now find flagged weeks and look at context
    for (let i = 0; i < weekDiffs.length; i++) {
      const w = weekDiffs[i];
      if (w.diff == null || w.absDiff < 2) continue;
      if (w.gameCount < 9) continue;
      if (excludedSeasonIDs.has(w.row.seasonID)) continue;

      // Look at surrounding weeks (up to 3 before and after)
      const context = [];
      for (let j = Math.max(0, i - 3); j <= Math.min(weekDiffs.length - 1, i + 3); j++) {
        const c = weekDiffs[j];
        context.push({
          season: c.row.seasonName,
          week: c.row.week,
          stored: c.stored,
          computed: c.computedAvg,
          diff: c.diff,
          absDiff: c.absDiff,
          gameCount: c.gameCount,
          isCurrent: j === i,
          isPenalty: c.row.isPenalty,
        });
      }

      // Classify: check if weeks before and after are also off
      const before = context.filter(c => !c.isCurrent && context.indexOf(c) < context.findIndex(c2 => c2.isCurrent));
      const after = context.filter(c => !c.isCurrent && context.indexOf(c) > context.findIndex(c2 => c2.isCurrent));

      const beforeOff = before.filter(c => c.absDiff != null && c.absDiff >= 2).length;
      const afterOff = after.filter(c => c.absDiff != null && c.absDiff >= 2).length;
      const beforeClean = before.filter(c => c.absDiff != null && c.absDiff <= 1).length;
      const afterClean = after.filter(c => c.absDiff != null && c.absDiff <= 1).length;

      let pattern;
      if (beforeClean > 0 && afterClean > 0 && beforeOff === 0 && afterOff === 0) {
        pattern = 'ONE-OFF';
      } else if (beforeClean > 0 && beforeOff === 0 && afterOff > 0) {
        pattern = 'ONSET';
      } else if (beforeOff > 0 && afterClean > 0 && afterOff === 0) {
        pattern = 'RECOVERY';
      } else if (beforeOff > 0 && afterOff > 0) {
        pattern = 'SUSTAINED';
      } else if (beforeOff > 0 || afterOff > 0) {
        pattern = 'PARTIAL';
      } else {
        pattern = 'EDGE'; // at start/end of data, can't tell
      }

      const entry = {
        bowlerName: w.row.bowlerName,
        season: w.row.seasonName,
        week: w.row.week,
        stored: w.stored,
        computed: w.computedAvg,
        diff: w.diff,
        absDiff: w.absDiff,
        gameCount: w.gameCount,
        pattern,
        context,
      };

      if (pattern === 'ONE-OFF') patterns.oneOff.push(entry);
      else patterns.sustained.push(entry);
    }
  }

  // Deduplicate sustained runs — group consecutive flagged weeks for same bowler
  const runs = [];
  const sustainedByBowler = {};
  for (const e of patterns.sustained) {
    const key = e.bowlerName;
    if (!sustainedByBowler[key]) sustainedByBowler[key] = [];
    sustainedByBowler[key].push(e);
  }

  // Print summary
  console.log(`═══ PATTERN SUMMARY (2+ pins off, excl. Seasons I-III, Denis Webb, <9 games) ═══\n`);
  console.log(`ONE-OFF (clean before & after):  ${patterns.oneOff.length}`);
  console.log(`SUSTAINED/ONSET/OTHER:          ${patterns.sustained.length}`);
  console.log();

  // Print one-offs with 10+ diff
  const bigOneOffs = patterns.oneOff.filter(e => e.absDiff >= 10);
  if (bigOneOffs.length > 0) {
    console.log(`═══ ONE-OFF BLIPS (10+ pins, clean weeks around them) ═══\n`);
    for (const e of bigOneOffs.sort((a, b) => b.absDiff - a.absDiff)) {
      console.log(`${e.bowlerName} — ${e.season} W${e.week} (stored=${e.stored}, computed=${e.computed}, diff=${e.diff > 0 ? '+' : ''}${e.diff})`);
      for (const c of e.context) {
        const marker = c.isCurrent ? ' >>>' : '    ';
        const diffStr = c.diff != null ? (c.diff > 0 ? '+' : '') + c.diff : 'n/a';
        const penalty = c.isPenalty ? ' [PENALTY]' : '';
        console.log(`${marker} ${c.season} W${c.week}: stored=${c.stored ?? '-'} computed=${c.computed ?? '-'} diff=${diffStr}${penalty}`);
      }
      console.log();
    }
  }

  // Print sustained/onset patterns grouped by bowler, for 10+ diff
  const bigSustained = patterns.sustained.filter(e => e.absDiff >= 10);
  if (bigSustained.length > 0) {
    console.log(`═══ SUSTAINED/ONSET DISCREPANCIES (10+ pins) ═══\n`);
    // Group by bowler+season for cleaner output
    const groups = {};
    for (const e of bigSustained) {
      const key = `${e.bowlerName}|${e.season}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(e);
    }

    for (const [key, entries] of Object.entries(groups).sort((a, b) => {
      const aMax = Math.max(...a[1].map(e => e.absDiff));
      const bMax = Math.max(...b[1].map(e => e.absDiff));
      return bMax - aMax;
    })) {
      const first = entries[0];
      // Show the context from the first entry's perspective (widest window)
      const allContext = first.context;
      console.log(`${first.bowlerName} — ${first.season} (${first.pattern}, ${entries.length} weeks flagged)`);
      for (const c of allContext) {
        const marker = c.isCurrent ? ' >>>' : '    ';
        const diffStr = c.diff != null ? (c.diff > 0 ? '+' : '') + c.diff : 'n/a';
        const flag = c.absDiff >= 10 ? ' <<<' : '';
        console.log(`${marker} ${c.season} W${c.week}: stored=${c.stored ?? '-'} computed=${c.computed ?? '-'} diff=${diffStr}${flag}`);
      }
      // If more entries extend beyond the first's context window, show them
      if (entries.length > 1) {
        const shownWeeks = new Set(allContext.map(c => `${c.season}-${c.week}`));
        for (const e of entries.slice(1)) {
          for (const c of e.context) {
            const key2 = `${c.season}-${c.week}`;
            if (!shownWeeks.has(key2)) {
              shownWeeks.add(key2);
              const diffStr = c.diff != null ? (c.diff > 0 ? '+' : '') + c.diff : 'n/a';
              const flag = c.absDiff >= 10 ? ' <<<' : '';
              console.log(`     ${c.season} W${c.week}: stored=${c.stored ?? '-'} computed=${c.computed ?? '-'} diff=${diffStr}${flag}`);
            }
          }
        }
      }
      console.log();
    }
  }

  // Now show the full one-off vs sustained breakdown for ALL severities
  console.log(`═══ FULL BREAKDOWN BY SEVERITY AND PATTERN ═══\n`);
  const allEntries = [...patterns.oneOff.map(e => ({...e, type: 'ONE-OFF'})), ...patterns.sustained.map(e => ({...e, type: 'OTHER'}))];

  const matrix = {};
  for (const bucket of ['2-3', '4-5', '6-9', '10-19', '20+']) {
    matrix[bucket] = { oneOff: 0, other: 0 };
  }
  for (const e of allEntries) {
    let bucket;
    if (e.absDiff >= 20) bucket = '20+';
    else if (e.absDiff >= 10) bucket = '10-19';
    else if (e.absDiff >= 6) bucket = '6-9';
    else if (e.absDiff >= 4) bucket = '4-5';
    else bucket = '2-3';

    if (e.type === 'ONE-OFF') matrix[bucket].oneOff++;
    else matrix[bucket].other++;
  }

  console.log('Severity    One-Off  Sustained/Other');
  console.log('----------  -------  ---------------');
  for (const [bucket, counts] of Object.entries(matrix)) {
    console.log(`${bucket.padEnd(12)}${String(counts.oneOff).padStart(7)}  ${String(counts.other).padStart(15)}`);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
