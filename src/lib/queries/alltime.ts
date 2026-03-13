/**
 * All-time career leaderboard query.
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
  }, [], { sql: GET_ALL_TIME_LEADERBOARD_SQL, allSeasons: true });
}
