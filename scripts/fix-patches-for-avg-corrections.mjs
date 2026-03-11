#!/usr/bin/env node
/**
 * Recalculate patches affected by the incomingAvg corrections.
 *
 * Affected patch types:
 *   - botw (Bowler of the Week): ranks by handSeries — winner may change for affected weeks
 *   - aboveAvg (Above Average All 3): compares games to incomingAvg — eligibility may change
 *   - hcpPlayoff (Handicap Playoff): ranks by season hcp avg — qualification may shift
 *
 * Affected contexts:
 *   - Season 13 (Spring 2014) Week 7
 *   - Season 17 (Spring 2016) Week 8
 *   - Season 17 (Spring 2016) Week 9
 *
 * Usage:
 *   node scripts/fix-patches-for-avg-corrections.mjs --dry-run
 *   node scripts/fix-patches-for-avg-corrections.mjs --apply
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
  options: { encrypt: true, trustServerCertificate: false, connectTimeout: 120000, requestTimeout: 60000 },
};

const apply = process.argv.includes('--apply');

// Affected weeks
const affectedWeeks = [
  { seasonID: 13, week: 7, label: "Spring 2014 Wk 7" },
  { seasonID: 17, week: 8, label: "Spring 2016 Wk 8" },
  { seasonID: 17, week: 9, label: "Spring 2016 Wk 9" },
];

// Affected bowler IDs (for season-level patches like hcpPlayoff)
const affectedBowlerIDs = [485, 460, 195, 309, 468, 51, 563, 611, 238];
// Morgan Ellis, McGregor Bell, Emmet Furlong, Jim Haverkamp, Melissa Adams,
// Ben Riseling, Scott Jeffries, Tony Lawrence, Harper Gordek

const affectedSeasonIDs = [13, 17];

async function main() {
  const pool = await sql.connect(config);

  console.log(apply ? "APPLYING patch fixes...\n" : "DRY RUN — preview only (use --apply to execute)\n");

  // Get patch IDs
  const patchRows = (await pool.request().query("SELECT patchID, code FROM patches")).recordset;
  const patchMap = new Map(patchRows.map(p => [p.code, p.patchID]));

  const botwID = patchMap.get('botw');
  const aboveAvgID = patchMap.get('aboveAvg');
  const hcpPlayoffID = patchMap.get('hcpPlayoff');

  // ═══ 1. BOTW — delete and recalculate for affected weeks ═══
  console.log("═══ BOTW (Bowler of the Week) ═══");
  for (const aw of affectedWeeks) {
    // Check current BOTW
    const current = await pool.request()
      .input('patchID', sql.Int, botwID)
      .input('seasonID', sql.Int, aw.seasonID)
      .input('week', sql.Int, aw.week)
      .query(`
        SELECT bp.bowlerID, b.bowlerName
        FROM bowlerPatches bp JOIN bowlers b ON bp.bowlerID = b.bowlerID
        WHERE bp.patchID = @patchID AND bp.seasonID = @seasonID AND bp.week = @week
      `);
    const currentWinner = current.recordset[0];

    // Compute correct BOTW
    const correct = await pool.request()
      .input('seasonID', sql.Int, aw.seasonID)
      .input('week', sql.Int, aw.week)
      .query(`
        SELECT TOP 1 sc.bowlerID, b.bowlerName, sc.handSeries
        FROM scores sc
        JOIN bowlers b ON sc.bowlerID = b.bowlerID
        WHERE sc.seasonID = @seasonID AND sc.week = @week
          AND sc.isPenalty = 0
          AND sc.incomingAvg IS NOT NULL AND sc.incomingAvg > 0
          AND EXISTS (
            SELECT 1 FROM scores sc3
            WHERE sc3.bowlerID = sc.bowlerID AND sc3.isPenalty = 0
              AND (sc3.seasonID < sc.seasonID OR (sc3.seasonID = sc.seasonID AND sc3.week < sc.week))
          )
        ORDER BY sc.handSeries DESC
      `);
    const correctWinner = correct.recordset[0];

    const changed = currentWinner?.bowlerID !== correctWinner?.bowlerID;
    const status = changed ? "CHANGED" : "unchanged";
    console.log(`  ${aw.label}: ${currentWinner?.bowlerName ?? 'none'} → ${correctWinner?.bowlerName ?? 'none'} (${status})${correctWinner ? ' HS=' + correctWinner.handSeries : ''}`);

    if (changed && apply) {
      // Delete old
      if (currentWinner) {
        await pool.request()
          .input('patchID', sql.Int, botwID)
          .input('seasonID', sql.Int, aw.seasonID)
          .input('week', sql.Int, aw.week)
          .query("DELETE FROM bowlerPatches WHERE patchID = @patchID AND seasonID = @seasonID AND week = @week");
        console.log(`    ✓ Removed ${currentWinner.bowlerName}`);
      }
      // Insert new
      if (correctWinner) {
        await pool.request()
          .input('bowlerID', sql.Int, correctWinner.bowlerID)
          .input('patchID', sql.Int, botwID)
          .input('seasonID', sql.Int, aw.seasonID)
          .input('week', sql.Int, aw.week)
          .query("INSERT INTO bowlerPatches (bowlerID, patchID, seasonID, week) VALUES (@bowlerID, @patchID, @seasonID, @week)");
        console.log(`    ✓ Added ${correctWinner.bowlerName}`);
      }
    }
  }

  // ═══ 2. aboveAvg — delete and recalculate for affected bowlers + weeks ═══
  console.log("\n═══ Above Average All 3 Games ═══");
  for (const aw of affectedWeeks) {
    // Check current aboveAvg patches for this week among affected bowlers
    const current = await pool.request()
      .input('patchID', sql.Int, aboveAvgID)
      .input('seasonID', sql.Int, aw.seasonID)
      .input('week', sql.Int, aw.week)
      .query(`
        SELECT bp.bowlerID, b.bowlerName
        FROM bowlerPatches bp JOIN bowlers b ON bp.bowlerID = b.bowlerID
        WHERE bp.patchID = @patchID AND bp.seasonID = @seasonID AND bp.week = @week
          AND bp.bowlerID IN (${affectedBowlerIDs.join(',')})
      `);

    // Compute correct aboveAvg for affected bowlers this week
    const correct = await pool.request()
      .input('seasonID', sql.Int, aw.seasonID)
      .input('week', sql.Int, aw.week)
      .query(`
        SELECT sc.bowlerID, b.bowlerName
        FROM scores sc JOIN bowlers b ON sc.bowlerID = b.bowlerID
        WHERE sc.seasonID = @seasonID AND sc.week = @week
          AND sc.isPenalty = 0
          AND sc.incomingAvg IS NOT NULL AND sc.incomingAvg > 0
          AND sc.game1 > sc.incomingAvg
          AND sc.game2 > sc.incomingAvg
          AND sc.game3 > sc.incomingAvg
          AND sc.bowlerID IN (${affectedBowlerIDs.join(',')})
      `);

    const currentIDs = new Set(current.recordset.map(r => r.bowlerID));
    const correctIDs = new Set(correct.recordset.map(r => r.bowlerID));

    // Find additions and removals
    const toRemove = current.recordset.filter(r => !correctIDs.has(r.bowlerID));
    const toAdd = correct.recordset.filter(r => !currentIDs.has(r.bowlerID));

    if (toRemove.length === 0 && toAdd.length === 0) {
      console.log(`  ${aw.label}: no changes`);
    } else {
      for (const r of toRemove) {
        console.log(`  ${aw.label}: REMOVE ${r.bowlerName}`);
        if (apply) {
          await pool.request()
            .input('bowlerID', sql.Int, r.bowlerID)
            .input('patchID', sql.Int, aboveAvgID)
            .input('seasonID', sql.Int, aw.seasonID)
            .input('week', sql.Int, aw.week)
            .query("DELETE FROM bowlerPatches WHERE bowlerID = @bowlerID AND patchID = @patchID AND seasonID = @seasonID AND week = @week");
          console.log(`    ✓ Removed`);
        }
      }
      for (const r of toAdd) {
        console.log(`  ${aw.label}: ADD ${r.bowlerName}`);
        if (apply) {
          await pool.request()
            .input('bowlerID', sql.Int, r.bowlerID)
            .input('patchID', sql.Int, aboveAvgID)
            .input('seasonID', sql.Int, aw.seasonID)
            .input('week', sql.Int, aw.week)
            .query("INSERT INTO bowlerPatches (bowlerID, patchID, seasonID, week) VALUES (@bowlerID, @patchID, @seasonID, @week)");
          console.log(`    ✓ Added`);
        }
      }
    }
  }

  // ═══ 3. hcpPlayoff — check if season-level qualification changed ═══
  console.log("\n═══ Handicap Playoff Qualification ═══");
  const playoffMinGamesOverrides = { 27: 9 };
  const minGamesCaseExpr = `CASE ${
    Object.entries(playoffMinGamesOverrides).map(([sid, g]) => `WHEN sc2.seasonID = ${sid} THEN ${g}`).join(' ')
  } ELSE 18 END`;

  for (const seasonID of affectedSeasonIDs) {
    // Current hcpPlayoff patches for this season
    const current = await pool.request()
      .input('patchID', sql.Int, hcpPlayoffID)
      .input('seasonID', sql.Int, seasonID)
      .query(`
        SELECT bp.bowlerID, b.bowlerName
        FROM bowlerPatches bp JOIN bowlers b ON bp.bowlerID = b.bowlerID
        WHERE bp.patchID = @patchID AND bp.seasonID = @seasonID
        ORDER BY b.bowlerName
      `);

    // Recalculate — full hcpPlayoff query for this season only
    // Min games for this specific season (default 18)
    const minGames = playoffMinGamesOverrides[seasonID] || 18;
    const correct = await pool.request()
      .input('seasonID', sql.Int, seasonID)
      .input('minGames', sql.Int, minGames)
      .query(`
        SELECT ranked.bowlerID, b.bowlerName
        FROM (
          SELECT ss.bowlerID,
            RANK() OVER (ORDER BY ss.hcpAvg DESC) AS hcpRank
          FROM (
            SELECT sc2.bowlerID,
              CAST(SUM(sc2.handSeries) * 1.0 / NULLIF(COUNT(sc2.scoreID) * 3, 0) AS DECIMAL(5,1)) AS hcpAvg
            FROM scores sc2
            WHERE sc2.isPenalty = 0 AND sc2.seasonID = @seasonID
            GROUP BY sc2.bowlerID
            HAVING COUNT(*) * 3 >= @minGames
          ) ss
          WHERE NOT EXISTS (
            SELECT 1 FROM (
              SELECT sc3.bowlerID,
                RANK() OVER (PARTITION BY b3.gender ORDER BY
                  CAST(SUM(sc3.game1 + sc3.game2 + sc3.game3) * 1.0 / NULLIF(COUNT(sc3.scoreID) * 3, 0) AS DECIMAL(5,1)) DESC
                ) AS scratchRank
              FROM scores sc3
              JOIN bowlers b3 ON b3.bowlerID = sc3.bowlerID
              WHERE sc3.isPenalty = 0 AND sc3.seasonID = @seasonID AND b3.gender IN ('M', 'F')
              GROUP BY sc3.bowlerID, b3.gender
              HAVING COUNT(*) * 3 >= @minGames
            ) sq
            WHERE sq.bowlerID = ss.bowlerID AND sq.scratchRank <= 8
          )
        ) ranked
        JOIN bowlers b ON ranked.bowlerID = b.bowlerID
        WHERE ranked.hcpRank <= 8
        ORDER BY b.bowlerName
      `);

    const currentNames = current.recordset.map(r => r.bowlerName).sort();
    const correctNames = correct.recordset.map(r => r.bowlerName).sort();
    const changed = JSON.stringify(currentNames) !== JSON.stringify(correctNames);

    if (!changed) {
      console.log(`  Season ${seasonID}: no changes (${currentNames.length} qualifiers)`);
    } else {
      const currentIDs = new Set(current.recordset.map(r => r.bowlerID));
      const correctIDs = new Set(correct.recordset.map(r => r.bowlerID));
      const removed = current.recordset.filter(r => !correctIDs.has(r.bowlerID));
      const added = correct.recordset.filter(r => !currentIDs.has(r.bowlerID));
      console.log(`  Season ${seasonID}: CHANGED`);
      for (const r of removed) {
        console.log(`    REMOVE ${r.bowlerName}`);
        if (apply) {
          await pool.request()
            .input('bowlerID', sql.Int, r.bowlerID)
            .input('patchID', sql.Int, hcpPlayoffID)
            .input('seasonID', sql.Int, seasonID)
            .query("DELETE FROM bowlerPatches WHERE bowlerID = @bowlerID AND patchID = @patchID AND seasonID = @seasonID AND week IS NULL");
          console.log(`      ✓ Removed`);
        }
      }
      for (const r of added) {
        console.log(`    ADD ${r.bowlerName}`);
        if (apply) {
          await pool.request()
            .input('bowlerID', sql.Int, r.bowlerID)
            .input('patchID', sql.Int, hcpPlayoffID)
            .input('seasonID', sql.Int, seasonID)
            .query("INSERT INTO bowlerPatches (bowlerID, patchID, seasonID, week) VALUES (@bowlerID, @patchID, @seasonID, NULL)");
          console.log(`      ✓ Added`);
        }
      }
    }
  }

  console.log(apply ? "\n✓ Patch fixes applied." : "\nDry run complete. Use --apply to execute.");
  await pool.close();
}

main().catch(err => { console.error(err); process.exit(1); });
