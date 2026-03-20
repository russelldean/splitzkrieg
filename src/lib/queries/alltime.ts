/**
 * All-time career leaderboard and record progression queries.
 */
import { getDb, cachedQuery } from '../db';

export interface AllTimeLeaderRow {
  bowlerID: number;
  bowlerName: string;
  slug: string;
  gender: string | null;
  gamesBowled: number;
  totalPins: number;
  careerAverage: number | null;
  highGame: number | null;
  highSeries: number | null;
  games200Plus: number;
  series600Plus: number;
  turkeys: number;
}

const GET_ALL_TIME_LEADERBOARD_SQL = `
  SELECT
    agg.bowlerID,
    b.bowlerName,
    b.slug,
    b.gender,
    agg.gamesBowled,
    agg.totalPins,
    agg.careerAverage,
    agg.highGame,
    agg.highSeries,
    agg.games200Plus,
    agg.series600Plus,
    agg.turkeys
  FROM (
    SELECT
      sc.bowlerID,
      COUNT(sc.scoreID) * 3                                AS gamesBowled,
      SUM(sc.scratchSeries)                                AS totalPins,
      CAST(
        SUM(sc.scratchSeries) * 1.0 /
        NULLIF(COUNT(sc.scoreID) * 3, 0)
      AS DECIMAL(5,1))                                     AS careerAverage,
      MAX(
        CASE
          WHEN sc.game1 >= sc.game2 AND sc.game1 >= sc.game3 THEN sc.game1
          WHEN sc.game2 >= sc.game3 THEN sc.game2
          ELSE sc.game3
        END
      )                                                    AS highGame,
      MAX(sc.scratchSeries)                                AS highSeries,
      SUM(
        CASE WHEN sc.game1 >= 200 THEN 1 ELSE 0 END +
        CASE WHEN sc.game2 >= 200 THEN 1 ELSE 0 END +
        CASE WHEN sc.game3 >= 200 THEN 1 ELSE 0 END
      )                                                    AS games200Plus,
      SUM(CASE WHEN sc.scratchSeries >= 600 THEN 1 ELSE 0 END) AS series600Plus,
      SUM(ISNULL(sc.turkeys, 0))                           AS turkeys
    FROM scores sc
    WHERE sc.isPenalty = 0
    GROUP BY sc.bowlerID
  ) agg
  JOIN bowlers b ON b.bowlerID = agg.bowlerID
  ORDER BY agg.careerAverage DESC
`;

export async function getAllTimeLeaderboard(): Promise<AllTimeLeaderRow[]> {
  return cachedQuery('getAllTimeLeaderboard', async () => {
    const db = await getDb();
    const result = await db.request().query<AllTimeLeaderRow>(GET_ALL_TIME_LEADERBOARD_SQL);
    return result.recordset;
  }, [], { sql: GET_ALL_TIME_LEADERBOARD_SQL, dependsOn: ['scores'] });
}

/* ── High Game Record Progression ───────────────────────────────── */

export interface HighGameRecord {
  score: number;
  bowlerName: string;
  slug: string;
  seasonID: number;
  week: number;
  nightNumber: number;
  displayName: string;
  romanNumeral: string;
  matchDate: string | null;
}

const HIGH_GAME_PROGRESSION_SQL = `
  WITH allGames AS (
    SELECT sc.bowlerID, sc.seasonID, sc.week, sc.game1 AS score
    FROM scores sc WHERE sc.isPenalty = 0 AND sc.game1 IS NOT NULL
    UNION ALL
    SELECT sc.bowlerID, sc.seasonID, sc.week, sc.game2
    FROM scores sc WHERE sc.isPenalty = 0 AND sc.game2 IS NOT NULL
    UNION ALL
    SELECT sc.bowlerID, sc.seasonID, sc.week, sc.game3
    FROM scores sc WHERE sc.isPenalty = 0 AND sc.game3 IS NOT NULL
  ),
  weekBest AS (
    SELECT
      ag.seasonID, ag.week,
      MAX(ag.score) AS bestScore
    FROM allGames ag
    GROUP BY ag.seasonID, ag.week
  ),
  withRunningMax AS (
    SELECT
      wb.seasonID, wb.week, wb.bestScore,
      MAX(wb.bestScore) OVER (
        ORDER BY sn.year, CASE sn.period WHEN 'Spring' THEN 1 ELSE 2 END, wb.week
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
      ) AS runningMax
    FROM weekBest wb
    JOIN seasons sn ON sn.seasonID = wb.seasonID
  ),
  withPrev AS (
    SELECT
      r.seasonID, r.week, r.bestScore, r.runningMax,
      LAG(r.runningMax) OVER (
        ORDER BY sn.year, CASE sn.period WHEN 'Spring' THEN 1 ELSE 2 END, r.week
      ) AS prevMax
    FROM withRunningMax r
    JOIN seasons sn ON sn.seasonID = r.seasonID
  )
  SELECT
    p.runningMax AS score,
    b.bowlerName,
    b.slug,
    p.seasonID,
    p.week,
    sch.nightNumber,
    sn.displayName,
    sn.romanNumeral,
    sch.matchDate
  FROM withPrev p
  JOIN seasons sn ON sn.seasonID = p.seasonID
  LEFT JOIN (
    SELECT seasonID, week, MIN(matchDate) AS matchDate, MIN(nightNumber) AS nightNumber
    FROM schedule
    GROUP BY seasonID, week
  ) sch ON sch.seasonID = p.seasonID AND sch.week = p.week
  CROSS APPLY (
    SELECT TOP 1 ag.bowlerID
    FROM allGames ag
    WHERE ag.seasonID = p.seasonID AND ag.week = p.week AND ag.score = p.runningMax
    ORDER BY ag.bowlerID
  ) topBowler
  JOIN bowlers b ON b.bowlerID = topBowler.bowlerID
  WHERE p.runningMax > ISNULL(p.prevMax, 0)
  ORDER BY sn.year, CASE sn.period WHEN 'Spring' THEN 1 ELSE 2 END, p.week
`;

export async function getHighGameProgression(): Promise<HighGameRecord[]> {
  return cachedQuery('getHighGameProgression', async () => {
    const db = await getDb();
    const result = await db.request().query<HighGameRecord>(HIGH_GAME_PROGRESSION_SQL);
    // Deduplicate: if the same score appears from multiple bowlers in the same week,
    // keep the first (the query already orders deterministically)
    const seen = new Set<string>();
    const deduped: HighGameRecord[] = [];
    for (const row of result.recordset) {
      const key = `${row.seasonID}-${row.week}-${row.score}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push({
          ...row,
          matchDate: row.matchDate ? new Date(row.matchDate).toISOString() : null,
        });
      }
    }
    return deduped;
  }, [], { sql: HIGH_GAME_PROGRESSION_SQL, dependsOn: ['scores'] });
}
