/**
 * Populate the bowlerPatches table from score data.
 *
 * Usage:
 *   node scripts/populate-patches.mjs              # insert missing patches
 *   node scripts/populate-patches.mjs --wipe       # wipe and repopulate all
 *   node scripts/populate-patches.mjs --dry-run    # preview without writing
 *   node scripts/populate-patches.mjs --patch=botw # only repopulate one patch type
 *   node scripts/populate-patches.mjs --wipe --patch=botw --season=35 --week=4
 *                                                  # wipe+rebuild botw for one week
 *   node scripts/populate-patches.mjs --wipe --patch=aboveAvg --season=35
 *                                                  # wipe+rebuild aboveAvg for one season
 */
import sql from 'mssql';
import { readFileSync } from 'fs';

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
    requestTimeout: 120000,
  },
};

async function main() {
  const pool = await new sql.ConnectionPool(dbConfig).connect();
  const dryRun = process.argv.includes('--dry-run');
  const wipe = process.argv.includes('--wipe');
  const patchFilter = process.argv.find(a => a.startsWith('--patch='));
  const targetPatch = patchFilter ? patchFilter.split('=')[1] : null;
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
  console.log(dryRun ? '=== DRY RUN ===' : '=== POPULATING bowlerPatches ===');
  console.log(`Scope: ${scopeLabel}`);

  // Load patch catalog
  const patchRows = (await pool.request().query('SELECT patchID, code FROM patches')).recordset;
  const patchMap = new Map(patchRows.map(p => [p.code, p.patchID]));
  console.log(`Patch catalog: ${patchRows.map(p => p.code).join(', ')}\n`);

  // Wipe if requested (scoped by season/week when provided)
  if (wipe) {
    if (targetPatch) {
      const pid = patchMap.get(targetPatch);
      if (!pid) { console.error(`Unknown patch: ${targetPatch}`); process.exit(1); }
      const req = pool.request().input('pid', sql.Int, pid);
      let wipeSQL = 'DELETE FROM bowlerPatches WHERE patchID = @pid';
      if (targetSeasonID) {
        req.input('sid', sql.Int, targetSeasonID);
        wipeSQL += ' AND seasonID = @sid';
      }
      if (targetWeek) {
        req.input('wk', sql.Int, targetWeek);
        wipeSQL += ' AND week = @wk';
      }
      const del = await req.query(wipeSQL);
      console.log(`Wiped ${del.rowsAffected[0]} rows for patch "${targetPatch}" (${scopeLabel})`);
    } else {
      const req = pool.request();
      let wipeSQL = 'DELETE FROM bowlerPatches WHERE 1=1';
      if (targetSeasonID) {
        req.input('sid', sql.Int, targetSeasonID);
        wipeSQL += ' AND seasonID = @sid';
      }
      if (targetWeek) {
        req.input('wk', sql.Int, targetWeek);
        wipeSQL += ' AND week = @wk';
      }
      const del = await req.query(wipeSQL);
      console.log(`Wiped ${del.rowsAffected[0]} total rows (${scopeLabel})`);
    }
  }

  let totalInserted = 0;

  // Scope filters for SQL injection into queries
  // Weekly patches use sc.seasonID / sc.week
  const weeklyFilter = [
    targetSeasonID ? `sc.seasonID = ${parseInt(targetSeasonID)}` : null,
    targetWeek ? `sc.week = ${parseInt(targetWeek)}` : null,
  ].filter(Boolean).join(' AND ');
  const weeklyAnd = weeklyFilter ? ` AND ${weeklyFilter}` : '';

  // Season-level patches use pr.seasonID or ch.seasonID (varies by query)
  const seasonFilter = targetSeasonID ? parseInt(targetSeasonID) : null;

  async function insertPatches(code, query, label) {
    if (targetPatch && targetPatch !== code) return;
    const pid = patchMap.get(code);
    if (!pid) { console.log(`  SKIP ${code} — not in patches table`); return; }

    console.log(`\n--- ${label} (${code}) ---`);
    const rows = (await pool.request().query(query)).recordset;
    console.log(`  Found ${rows.length} patches`);

    if (rows.length === 0) return;

    let inserted = 0;
    for (const row of rows) {
      if (dryRun) {
        inserted++;
        continue;
      }
      try {
        await pool.request()
          .input('bowlerID', sql.Int, row.bowlerID)
          .input('patchID', sql.Int, pid)
          .input('seasonID', row.seasonID != null ? sql.Int : sql.Int, row.seasonID ?? null)
          .input('week', row.week != null ? sql.Int : sql.Int, row.week ?? null)
          .query(`
            INSERT INTO bowlerPatches (bowlerID, patchID, seasonID, week)
            SELECT @bowlerID, @patchID, @seasonID, @week
            WHERE NOT EXISTS (
              SELECT 1 FROM bowlerPatches
              WHERE bowlerID = @bowlerID AND patchID = @patchID
                AND ISNULL(seasonID, 0) = ISNULL(@seasonID, 0)
                AND ISNULL(week, 0) = ISNULL(@week, 0)
            )
          `);
        inserted++;
      } catch (err) {
        if (err.number === 2627) continue; // duplicate key — already exists
        throw err;
      }
    }
    console.log(`  ${dryRun ? 'Would insert' : 'Inserted'} ${inserted} rows`);
    totalInserted += inserted;
  }

  // ─── Perfect Game (300) from score data ───
  // Note: Geoffrey Berry's playoff 300 (S27) was manually inserted since
  // playoff scores aren't in the scores table.
  await insertPatches('perfectGame', `
    SELECT sc.bowlerID, sc.seasonID, sc.week
    FROM scores sc
    WHERE sc.isPenalty = 0
      AND (sc.game1 = 300 OR sc.game2 = 300 OR sc.game3 = 300)
      ${weeklyAnd}
  `, 'Perfect Game');

  // ─── Bowler of the Week ───
  // Note: when scoped to a single week, we still need the full PARTITION to
  // determine the winner, but we filter the outer result to just that week.
  await insertPatches('botw', `
    SELECT x.bowlerID, x.seasonID, x.week
    FROM (
      SELECT sc.seasonID, sc.week, sc.bowlerID,
        ROW_NUMBER() OVER (PARTITION BY sc.seasonID, sc.week ORDER BY sc.handSeries DESC) AS rn
      FROM scores sc
      WHERE sc.isPenalty = 0
        AND sc.incomingAvg IS NOT NULL AND sc.incomingAvg > 0
        ${weeklyAnd}
    ) x WHERE x.rn = 1
  `, 'Bowler of the Week');

  // ─── Weekly High Game ───
  await insertPatches('highGame', `
    SELECT x.bowlerID, x.seasonID, x.week
    FROM (
      SELECT sc.seasonID, sc.week, sc.bowlerID,
        ROW_NUMBER() OVER (PARTITION BY sc.seasonID, sc.week ORDER BY
          CASE WHEN sc.game1 >= ISNULL(sc.game2,0) AND sc.game1 >= ISNULL(sc.game3,0) THEN sc.game1
               WHEN sc.game2 >= ISNULL(sc.game3,0) THEN sc.game2
               ELSE sc.game3 END DESC) AS rn
      FROM scores sc
      WHERE sc.isPenalty = 0
        ${weeklyAnd}
    ) x WHERE x.rn = 1
  `, 'Weekly High Game');

  // ─── Weekly High Series ───
  await insertPatches('highSeries', `
    SELECT x.bowlerID, x.seasonID, x.week
    FROM (
      SELECT sc.seasonID, sc.week, sc.bowlerID,
        ROW_NUMBER() OVER (PARTITION BY sc.seasonID, sc.week ORDER BY sc.scratchSeries DESC) AS rn
      FROM scores sc
      WHERE sc.isPenalty = 0
        ${weeklyAnd}
    ) x WHERE x.rn = 1
  `, 'Weekly High Series');

  // ─── Above Average All 3 Games ───
  await insertPatches('aboveAvg', `
    SELECT sc.bowlerID, sc.seasonID, sc.week
    FROM scores sc
    WHERE sc.isPenalty = 0
      AND sc.incomingAvg IS NOT NULL AND sc.incomingAvg > 0
      AND sc.game1 > sc.incomingAvg
      AND sc.game2 > sc.incomingAvg
      AND sc.game3 > sc.incomingAvg
      ${weeklyAnd}
  `, 'Above Average All 3 Games');

  // ─── Three of a Kind ───
  await insertPatches('threeOfAKind', `
    SELECT sc.bowlerID, sc.seasonID, sc.week
    FROM scores sc
    WHERE sc.isPenalty = 0
      AND sc.game1 = sc.game2 AND sc.game2 = sc.game3
      AND sc.game1 IS NOT NULL AND sc.game1 > 0
      ${weeklyAnd}
  `, 'Three of a Kind');

  // ─── Team Playoff appearances (must have 9+ games for that team) ───
  await insertPatches('playoff', `
    SELECT DISTINCT sc.bowlerID, pr.seasonID, NULL AS week
    FROM playoffResults pr
    JOIN scores sc ON sc.seasonID = pr.seasonID
      AND sc.isPenalty = 0
      AND (sc.teamID = pr.team1ID OR sc.teamID = pr.team2ID)
    WHERE pr.playoffType = 'Team'
      ${seasonFilter ? `AND pr.seasonID = ${seasonFilter}` : ''}
      AND (SELECT COUNT(*) FROM scores sc2
           WHERE sc2.bowlerID = sc.bowlerID AND sc2.seasonID = pr.seasonID
             AND sc2.teamID = sc.teamID AND sc2.isPenalty = 0) >= 3
  `, 'Team Playoff');

  // ─── Team Championship (must have 9+ games for that team) ───
  await insertPatches('champion', `
    SELECT DISTINCT sc.bowlerID, ch.seasonID, NULL AS week
    FROM seasonChampions ch
    JOIN scores sc ON sc.seasonID = ch.seasonID
      AND sc.teamID = ch.winnerTeamID
      AND sc.isPenalty = 0
    WHERE ch.championshipType = 'Team'
      ${seasonFilter ? `AND ch.seasonID = ${seasonFilter}` : ''}
      AND (SELECT COUNT(*) FROM scores sc2
           WHERE sc2.bowlerID = sc.bowlerID AND sc2.seasonID = ch.seasonID
             AND sc2.teamID = ch.winnerTeamID AND sc2.isPenalty = 0) >= 3
  `, 'Team Championship');

  // ─── Playoff min-games override per season (default 18) ───
  // Some seasons had shorter schedules or different qualification rules.
  const playoffMinGamesOverrides = { 27: 9 };
  const minGamesCaseExpr = `CASE ${
    Object.entries(playoffMinGamesOverrides).map(([sid, g]) => `WHEN seasonID = ${sid} THEN ${g}`).join(' ')
  } ELSE 18 END`;

  // ─── Scratch Playoff qualifiers ───
  // Use DECIMAL(5,1) to match the UI leaderboard rounding
  await insertPatches('scratchPlayoff', `
    SELECT ranked.bowlerID, ranked.seasonID, NULL AS week
    FROM (
      SELECT sc2.seasonID, sc2.bowlerID,
        RANK() OVER (PARTITION BY sc2.seasonID, b2.gender ORDER BY
          CAST(SUM(sc2.game1 + sc2.game2 + sc2.game3) * 1.0 / NULLIF(COUNT(sc2.scoreID) * 3, 0) AS DECIMAL(5,1)) DESC
        ) AS scratchRank
      FROM scores sc2
      JOIN bowlers b2 ON b2.bowlerID = sc2.bowlerID
      WHERE sc2.isPenalty = 0 AND b2.gender IN ('M', 'F')
        ${seasonFilter ? `AND sc2.seasonID = ${seasonFilter}` : ''}
      GROUP BY sc2.seasonID, sc2.bowlerID, b2.gender
      HAVING COUNT(*) * 3 >= ${minGamesCaseExpr}
    ) ranked
    WHERE ranked.scratchRank <= 8
  `, 'Scratch Playoff');

  // ─── Handicap Playoff qualifiers (top 8 non-scratch-qualifiers by hcp avg) ───
  // Use DECIMAL(5,1) to match the UI leaderboard rounding
  await insertPatches('hcpPlayoff', `
    SELECT ranked.bowlerID, ranked.seasonID, NULL AS week
    FROM (
      SELECT ss.seasonID, ss.bowlerID,
        RANK() OVER (PARTITION BY ss.seasonID ORDER BY ss.hcpAvg DESC) AS hcpRank
      FROM (
        SELECT sc2.seasonID, sc2.bowlerID,
          CAST(SUM(sc2.handSeries) * 1.0 / NULLIF(COUNT(sc2.scoreID) * 3, 0) AS DECIMAL(5,1)) AS hcpAvg
        FROM scores sc2
        WHERE sc2.isPenalty = 0
          ${seasonFilter ? `AND sc2.seasonID = ${seasonFilter}` : ''}
        GROUP BY sc2.seasonID, sc2.bowlerID
        HAVING COUNT(*) * 3 >= ${minGamesCaseExpr}
      ) ss
      WHERE NOT EXISTS (
        SELECT 1 FROM (
          SELECT sc3.seasonID, sc3.bowlerID,
            RANK() OVER (PARTITION BY sc3.seasonID, b3.gender ORDER BY
              CAST(SUM(sc3.game1 + sc3.game2 + sc3.game3) * 1.0 / NULLIF(COUNT(sc3.scoreID) * 3, 0) AS DECIMAL(5,1)) DESC
            ) AS scratchRank
          FROM scores sc3
          JOIN bowlers b3 ON b3.bowlerID = sc3.bowlerID
          WHERE sc3.isPenalty = 0 AND b3.gender IN ('M', 'F')
            ${seasonFilter ? `AND sc3.seasonID = ${seasonFilter}` : ''}
          GROUP BY sc3.seasonID, sc3.bowlerID, b3.gender
          HAVING COUNT(*) * 3 >= ${minGamesCaseExpr}
        ) sq
        WHERE sq.bowlerID = ss.bowlerID AND sq.seasonID = ss.seasonID AND sq.scratchRank <= 8
      )
    ) ranked
    WHERE ranked.hcpRank <= 8
  `, 'Handicap Playoff');

  // ─── Scratch Champion (individual playoff winner — men's or women's scratch) ───
  await insertPatches('scratchChampion', `
    SELECT sc.winnerBowlerID AS bowlerID, sc.seasonID, NULL AS week
    FROM seasonChampions sc
    WHERE sc.championshipType IN ('MensScratch', 'WomensScratch')
      AND sc.winnerBowlerID IS NOT NULL
      ${seasonFilter ? `AND sc.seasonID = ${seasonFilter}` : ''}
  `, 'Scratch Champion');

  // ─── Handicap Champion (individual playoff winner — handicap) ───
  await insertPatches('hcpChampion', `
    SELECT sc.winnerBowlerID AS bowlerID, sc.seasonID, NULL AS week
    FROM seasonChampions sc
    WHERE sc.championshipType = 'Handicap'
      AND sc.winnerBowlerID IS NOT NULL
      ${seasonFilter ? `AND sc.seasonID = ${seasonFilter}` : ''}
  `, 'Handicap Champion');

  // ─── Team Captain (career-level, no season/week — skip if scoped) ───
  if (!targetSeasonID) {
    await insertPatches('captain', `
      SELECT captainBowlerID AS bowlerID, NULL AS seasonID, NULL AS week
      FROM teams
      WHERE captainBowlerID IS NOT NULL
    `, 'Team Captain');
  } else if (!targetPatch || targetPatch === 'captain') {
    console.log('\n--- Team Captain (captain) ---');
    console.log('  Skipped (career-level patch, not affected by season scope)');
  }

  console.log(`\n=== TOTAL: ${totalInserted} patches ${dryRun ? 'would be' : ''} inserted ===`);
  await pool.close();
}

main().catch(err => { console.error(err); process.exit(1); });
