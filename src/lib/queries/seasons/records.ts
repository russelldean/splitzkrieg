/**
 * Season records and hero stats queries.
 */
import { getDb, cachedQuery } from '../../db';

export interface SeasonRecords {
  highScratchGame: { bowlerName: string; slug: string; value: number } | null;
  highScratchSeries: { bowlerName: string; slug: string; value: number } | null;
  highHcpSeries: { bowlerName: string; slug: string; value: number } | null;
  mostTurkeys: { bowlerName: string; slug: string; value: number } | null;
  most200Games: { bowlerName: string; slug: string; value: number } | null;
}

export interface SeasonHeroStats {
  leagueAverage: number | null;
  totalGames: number;
  totalBowlers: number;
  topAverage: { bowlerName: string; slug: string; value: number } | null;
  highGame: { bowlerName: string; slug: string; value: number } | null;
  highSeries: { bowlerName: string; slug: string; value: number } | null;
  champion: string | null;
}

const RECORDS_HIGH_GAME_SQL = `
  SELECT TOP 1
    b.bowlerName, b.slug,
    g.score AS value
  FROM (
    SELECT bowlerID, game1 AS score FROM scores WHERE seasonID = @seasonID AND isPenalty = 0
    UNION ALL
    SELECT bowlerID, game2 FROM scores WHERE seasonID = @seasonID AND isPenalty = 0
    UNION ALL
    SELECT bowlerID, game3 FROM scores WHERE seasonID = @seasonID AND isPenalty = 0
  ) g
  JOIN bowlers b ON g.bowlerID = b.bowlerID
  WHERE g.score IS NOT NULL
  ORDER BY g.score DESC
`;

const RECORDS_HIGH_SERIES_SQL = `
  SELECT TOP 1
    b.bowlerName, b.slug,
    sc.scratchSeries AS value
  FROM scores sc
  JOIN bowlers b ON sc.bowlerID = b.bowlerID
  WHERE sc.seasonID = @seasonID AND sc.isPenalty = 0
  ORDER BY sc.scratchSeries DESC
`;

const RECORDS_HIGH_HCP_SERIES_SQL = `
  SELECT TOP 1
    b.bowlerName, b.slug,
    sc.handSeries AS value
  FROM scores sc
  JOIN bowlers b ON sc.bowlerID = b.bowlerID
  WHERE sc.seasonID = @seasonID AND sc.isPenalty = 0
  ORDER BY sc.handSeries DESC
`;

const RECORDS_TURKEYS_SQL = `
  SELECT TOP 1
    b.bowlerName, b.slug,
    SUM(ISNULL(sc.turkeys, 0)) AS value
  FROM scores sc
  JOIN bowlers b ON sc.bowlerID = b.bowlerID
  WHERE sc.seasonID = @seasonID AND sc.isPenalty = 0
  GROUP BY b.bowlerID, b.bowlerName, b.slug
  ORDER BY value DESC
`;

const RECORDS_200_GAMES_SQL = `
  SELECT TOP 1
    b.bowlerName, b.slug,
    SUM(
      CASE WHEN sc.game1 >= 200 THEN 1 ELSE 0 END +
      CASE WHEN sc.game2 >= 200 THEN 1 ELSE 0 END +
      CASE WHEN sc.game3 >= 200 THEN 1 ELSE 0 END
    ) AS value
  FROM scores sc
  JOIN bowlers b ON sc.bowlerID = b.bowlerID
  WHERE sc.seasonID = @seasonID AND sc.isPenalty = 0
  GROUP BY b.bowlerID, b.bowlerName, b.slug
  ORDER BY value DESC
`;

const RECORDS_ALL_SQL = RECORDS_HIGH_GAME_SQL + RECORDS_HIGH_SERIES_SQL
  + RECORDS_HIGH_HCP_SERIES_SQL + RECORDS_TURKEYS_SQL + RECORDS_200_GAMES_SQL;

export async function getSeasonRecords(seasonID: number): Promise<SeasonRecords> {
  const empty: SeasonRecords = {
    highScratchGame: null,
    highScratchSeries: null,
    highHcpSeries: null,
    mostTurkeys: null,
    most200Games: null,
  };
  return cachedQuery(`getSeasonRecords-${seasonID}`, async () => {
    const db = await getDb();

    type RecordRow = { bowlerName: string; slug: string; value: number };

    const highGameResult = await db.request()
      .input('seasonID', seasonID)
      .query<RecordRow>(RECORDS_HIGH_GAME_SQL);

    const highSeriesResult = await db.request()
      .input('seasonID', seasonID)
      .query<RecordRow>(RECORDS_HIGH_SERIES_SQL);

    const highHcpSeriesResult = await db.request()
      .input('seasonID', seasonID)
      .query<RecordRow>(RECORDS_HIGH_HCP_SERIES_SQL);

    const turkeyResult = await db.request()
      .input('seasonID', seasonID)
      .query<RecordRow>(RECORDS_TURKEYS_SQL);

    const games200Result = await db.request()
      .input('seasonID', seasonID)
      .query<RecordRow>(RECORDS_200_GAMES_SQL);

    return {
      highScratchGame: highGameResult.recordset[0] ?? null,
      highScratchSeries: highSeriesResult.recordset[0] ?? null,
      highHcpSeries: highHcpSeriesResult.recordset[0] ?? null,
      mostTurkeys: turkeyResult.recordset[0] ?? null,
      most200Games: games200Result.recordset[0] ?? null,
    };
  }, empty, { sql: RECORDS_ALL_SQL, seasonID });
}

const HERO_STATS_SQL = `
  SELECT
    CAST(SUM(sc.scratchSeries) * 1.0 / NULLIF(COUNT(sc.scoreID) * 3, 0) AS DECIMAL(5,1)) AS leagueAverage,
    COUNT(sc.scoreID) * 3           AS totalGames,
    COUNT(DISTINCT sc.bowlerID)     AS totalBowlers
  FROM scores sc
  WHERE sc.seasonID = @seasonID
    AND sc.isPenalty = 0
`;

const HERO_TOP_AVG_SQL = `
  SELECT TOP 1
    b.bowlerName, b.slug,
    CAST(SUM(sc.scratchSeries) * 1.0 / NULLIF(COUNT(sc.scoreID) * 3, 0) AS DECIMAL(5,1)) AS value
  FROM scores sc
  JOIN bowlers b ON sc.bowlerID = b.bowlerID
  WHERE sc.seasonID = @seasonID AND sc.isPenalty = 0
  GROUP BY sc.bowlerID, b.bowlerName, b.slug
  HAVING COUNT(sc.scoreID) >= 3
  ORDER BY value DESC
`;

const HERO_HIGH_GAME_SQL = `
  SELECT TOP 1
    b.bowlerName, b.slug,
    g.score AS value
  FROM (
    SELECT bowlerID, game1 AS score FROM scores WHERE seasonID = @seasonID AND isPenalty = 0
    UNION ALL
    SELECT bowlerID, game2 FROM scores WHERE seasonID = @seasonID AND isPenalty = 0
    UNION ALL
    SELECT bowlerID, game3 FROM scores WHERE seasonID = @seasonID AND isPenalty = 0
  ) g
  JOIN bowlers b ON g.bowlerID = b.bowlerID
  WHERE g.score IS NOT NULL
  ORDER BY g.score DESC
`;

const HERO_HIGH_SERIES_SQL = `
  SELECT TOP 1
    b.bowlerName, b.slug,
    sc.scratchSeries AS value
  FROM scores sc
  JOIN bowlers b ON sc.bowlerID = b.bowlerID
  WHERE sc.seasonID = @seasonID AND sc.isPenalty = 0
  ORDER BY sc.scratchSeries DESC
`;

const HERO_CHAMPION_SQL = `
  SELECT t.teamName
  FROM seasonChampions sc
  JOIN teams t ON sc.winnerTeamID = t.teamID
  WHERE sc.seasonID = @seasonID AND sc.championshipType = 'Team'
`;

const HERO_ALL_SQL = HERO_STATS_SQL + HERO_TOP_AVG_SQL + HERO_HIGH_GAME_SQL
  + HERO_HIGH_SERIES_SQL + HERO_CHAMPION_SQL;

export async function getSeasonHeroStats(seasonID: number): Promise<SeasonHeroStats | null> {
  return cachedQuery(`getSeasonHeroStats-${seasonID}`, async () => {

    const db = await getDb();

    const statsResult = await db.request()
      .input('seasonID', seasonID)
      .query<{
        leagueAverage: number | null;
        totalGames: number;
        totalBowlers: number;
      }>(HERO_STATS_SQL);

    const stats = statsResult.recordset[0];

    type StatHolder = { bowlerName: string; slug: string; value: number };

    const topAvgResult = await db.request()
      .input('seasonID', seasonID)
      .query<StatHolder>(HERO_TOP_AVG_SQL);

    const highGameResult = await db.request()
      .input('seasonID', seasonID)
      .query<StatHolder>(HERO_HIGH_GAME_SQL);

    const highSeriesResult = await db.request()
      .input('seasonID', seasonID)
      .query<StatHolder>(HERO_HIGH_SERIES_SQL);

    const champResult = await db.request()
      .input('seasonID', seasonID)
      .query<{ teamName: string }>(HERO_CHAMPION_SQL);

    return {
      leagueAverage: stats?.leagueAverage ?? null,
      totalGames: stats?.totalGames ?? 0,
      totalBowlers: stats?.totalBowlers ?? 0,
      topAverage: topAvgResult.recordset[0] ?? null,
      highGame: highGameResult.recordset[0] ?? null,
      highSeries: highSeriesResult.recordset[0] ?? null,
      champion: champResult.recordset[0]?.teamName ?? null,
    };
  }, null, { sql: HERO_ALL_SQL, seasonID });
}
