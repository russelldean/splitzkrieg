/**
 * Count the games a bowler actually bowled, not three per row.
 *
 * A bowler who leaves mid-night keeps their own row with the unbowled game(s)
 * NULL (Molly Halligan S36 w6, Kelly Shirley S29 w5, Denis Webb S28 w8). Before
 * this, scratchSeries (game1+game2+game3) went NULL for that row, dropping the
 * pins they did bowl, while every average still divided by COUNT(rows) * 3. The
 * site read a partial night as 0 pins over 3 games.
 *
 * Rule (Russ, 2026-09-22): count the games they bowled and those pins, never a
 * game they did not bowl.
 *
 *   scratchSeries     pins actually bowled. NULL for penalty rows, as before.
 *   gamesBowled       non-NULL games on a real row, 0 on a penalty row. Every
 *                     per-game average divides by SUM(gamesBowled).
 *   bowledHandSeries  handicap pins for the games bowled only. handSeries keeps
 *                     the 199 for an unbowled game because the TEAM total needs
 *                     it; a bowler's handicap average must not include it.
 *
 * Also rewrites vw_BowlerCareerSummary and vw_BowlerSeasonStats onto the new
 * columns, and makes their high game NULL-safe (a NULL game3 used to null it).
 *
 * Usage: node scripts/add-games-bowled.mjs           (preview, writes nothing)
 *        node scripts/add-games-bowled.mjs --apply
 */
import sql from 'mssql';
import { loadEnv } from './lib/load-env.mjs';

const apply = process.argv.includes('--apply');

const HCP = `floor(((225)-case when floor([incomingAvg])<(70) then (70) else floor([incomingAvg]) end)*(0.95))`;
const NO_GAMES = `([isPenalty]=(1) OR ([game1] IS NULL AND [game2] IS NULL AND [game3] IS NULL))`;
const bowledHcpGame = (g) =>
  `case when [${g}] IS NULL then (0) when [incomingAvg] IS NULL then (219) else [${g}]+${HCP} end`;

const SCRATCH_SERIES = `case when ${NO_GAMES} then NULL
  else isnull([game1],(0))+isnull([game2],(0))+isnull([game3],(0)) end`;
const GAMES_BOWLED = `case when [isPenalty]=(1) then (0)
  else case when [game1] IS NULL then (0) else (1) end
     + case when [game2] IS NULL then (0) else (1) end
     + case when [game3] IS NULL then (0) else (1) end end`;
const BOWLED_HAND_SERIES = `case when ${NO_GAMES} then NULL
  else ${bowledHcpGame('game1')} + ${bowledHcpGame('game2')} + ${bowledHcpGame('game3')} end`;

// NULL-safe "best of three": a NULL game never wins and never nulls the result.
const highGame = (a) => `CASE WHEN ISNULL(${a}.game1, 0) >= ISNULL(${a}.game2, 0) AND ISNULL(${a}.game1, 0) >= ISNULL(${a}.game3, 0) THEN ${a}.game1
             WHEN ISNULL(${a}.game2, 0) >= ISNULL(${a}.game3, 0) THEN ${a}.game2
             ELSE ${a}.game3 END`;

const CAREER_VIEW = `
CREATE OR ALTER VIEW vw_BowlerCareerSummary AS
SELECT
    b.bowlerID,
    b.bowlerName,
    b.slug,
    b.gender,
    b.isActive,
    COUNT(s.scoreID)                                    AS totalGamesNights,
    ISNULL(SUM(s.gamesBowled), 0)                       AS totalGamesBowled,
    SUM(s.scratchSeries)                                AS totalPins,
    CAST(SUM(s.scratchSeries) * 1.0 /
         NULLIF(SUM(s.gamesBowled), 0) AS DECIMAL(5,1)) AS careerAverage,
    MAX(${highGame('s')})                          AS highGame,
    MAX(s.scratchSeries)                                AS highSeries,
    SUM(CASE WHEN s.game1 >= 200 THEN 1 ELSE 0 END +
        CASE WHEN s.game2 >= 200 THEN 1 ELSE 0 END +
        CASE WHEN s.game3 >= 200 THEN 1 ELSE 0 END)    AS games200Plus,
    SUM(CASE WHEN s.scratchSeries >= 600 THEN 1 ELSE 0 END) AS series600Plus,
    SUM(ISNULL(s.turkeys, 0))                           AS totalTurkeys,
    MIN(sn.year)                                        AS firstYear,
    MAX(sn.year)                                        AS lastYear,
    COUNT(DISTINCT s.seasonID)                          AS seasonsPlayed
FROM bowlers b
LEFT JOIN scores s ON b.bowlerID = s.bowlerID
LEFT JOIN seasons sn ON s.seasonID = sn.seasonID
GROUP BY b.bowlerID, b.bowlerName, b.slug, b.gender, b.isActive;`;

const SEASON_VIEW = `
CREATE OR ALTER VIEW vw_BowlerSeasonStats AS
SELECT
    sc.bowlerID,
    sc.seasonID,
    sn.romanNumeral,
    sn.displayName,
    sn.year,
    sn.period,
    t.teamName,
    COUNT(sc.scoreID)                                    AS nightsBowled,
    SUM(sc.gamesBowled)                                  AS gamesBowled,
    SUM(sc.scratchSeries)                                AS totalPins,
    CAST(SUM(sc.scratchSeries) * 1.0 /
         NULLIF(SUM(sc.gamesBowled), 0) AS DECIMAL(5,1)) AS seasonAverage,
    MAX(${highGame('sc')})                          AS highGame,
    MAX(sc.scratchSeries)                                AS highSeries,
    SUM(CASE WHEN sc.game1 >= 200 THEN 1 ELSE 0 END +
        CASE WHEN sc.game2 >= 200 THEN 1 ELSE 0 END +
        CASE WHEN sc.game3 >= 200 THEN 1 ELSE 0 END)    AS games200Plus,
    SUM(CASE WHEN sc.scratchSeries >= 600 THEN 1 ELSE 0 END) AS series600Plus,
    SUM(ISNULL(sc.turkeys, 0))                           AS turkeys
FROM scores sc
JOIN seasons sn ON sc.seasonID = sn.seasonID
LEFT JOIN teams t ON sc.teamID = t.teamID
GROUP BY sc.bowlerID, sc.seasonID, sn.romanNumeral, sn.displayName,
         sn.year, sn.period, t.teamName;`;

const PARTIAL_ROWS_SQL = (cols) => `
  SELECT s.scoreID, b.bowlerName, s.seasonID, s.week, s.game1, s.game2, s.game3${cols}
  FROM scores s JOIN bowlers b ON b.bowlerID = s.bowlerID
  WHERE s.isPenalty = 0 AND (s.game1 IS NULL OR s.game2 IS NULL OR s.game3 IS NULL)
  ORDER BY s.seasonID`;

async function main() {
  const pool = await sql.connect(loadEnv());
  const q = async (s) => (await pool.request().query(s)).recordset;

  const exists = (await q(`SELECT 1 x FROM sys.columns
    WHERE object_id = OBJECT_ID('scores') AND name = 'gamesBowled'`)).length > 0;

  // Anything besides auto-created statistics would block DROP COLUMN.
  const blockers = await q(`
    SELECT st.name, st.auto_created FROM sys.stats st
    JOIN sys.stats_columns sc ON sc.object_id = st.object_id AND sc.stats_id = st.stats_id
    JOIN sys.columns c ON c.object_id = sc.object_id AND c.column_id = sc.column_id
    WHERE st.object_id = OBJECT_ID('scores') AND c.name = 'scratchSeries'`);
  console.log('Statistics on scratchSeries:', blockers.length ? blockers : 'none');

  // The expressions, evaluated inline, against every row, before anything changes.
  const preview = await q(`
    SELECT
      COUNT(*) AS totalRows,
      SUM(CASE WHEN ISNULL(scratchSeries, -1) <> ISNULL(newSS, -1) THEN 1 ELSE 0 END) AS seriesChanged,
      SUM(CASE WHEN isPenalty = 0 AND gb <> 3 THEN 1 ELSE 0 END)                   AS realRowsUnder3,
      SUM(CASE WHEN isPenalty = 1 AND (gb <> 0 OR newSS IS NOT NULL OR bhs IS NOT NULL) THEN 1 ELSE 0 END) AS penaltyLeaks,
      SUM(CASE WHEN gb = 3 AND bhs <> handSeries THEN 1 ELSE 0 END)                 AS fullRowsHandDiffer
    FROM (SELECT *, ${SCRATCH_SERIES} AS newSS, ${GAMES_BOWLED} AS gb, ${BOWLED_HAND_SERIES} AS bhs FROM scores) x`);
  console.log('Preview against every row:');
  console.table(preview);
  const p = preview[0];
  if (p.penaltyLeaks || p.fullRowsHandDiffer || p.seriesChanged > 3 || p.realRowsUnder3 > 3) {
    console.error('More than the three known partial rows would change. Stopping.');
    process.exit(1);
  }
  if (blockers.some((b) => !b.auto_created)) {
    console.error('A user-created statistic would block DROP COLUMN. Stopping.');
    process.exit(1);
  }

  if (!apply) {
    console.log(exists ? 'Columns already exist.' : 'Preview only. Re-run with --apply.');
    await pool.close();
    return;
  }

  if (exists) {
    console.log('gamesBowled already exists; skipping the column change.');
  } else {
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      const r = () => new sql.Request(tx);
      for (const b of blockers) await r().query(`DROP STATISTICS scores.[${b.name}]`);
      await r().query(`ALTER TABLE scores DROP COLUMN scratchSeries`);
      await r().query(`ALTER TABLE scores ADD scratchSeries AS (${SCRATCH_SERIES}) PERSISTED`);
      await r().query(`ALTER TABLE scores ADD gamesBowled AS (${GAMES_BOWLED})`);
      await r().query(`ALTER TABLE scores ADD bowledHandSeries AS (${BOWLED_HAND_SERIES})`);
      await tx.commit();
      console.log('Columns changed.');
    } catch (e) {
      await tx.rollback();
      throw e;
    }
  }

  await q(CAREER_VIEW);
  await q(SEASON_VIEW);
  console.log('Views rewritten.');

  console.log('Partial rows after:');
  console.table(await q(PARTIAL_ROWS_SQL(', s.scratchSeries, s.gamesBowled, s.handSeries, s.bowledHandSeries')));
  await pool.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
