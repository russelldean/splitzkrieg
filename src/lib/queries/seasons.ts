/**
 * Season-related SQL queries.
 * Includes standings, leaderboards, stats, schedule, records, playoffs,
 * weekly scores, match results, race chart, and navigation.
 */
import { cache } from 'react';
import { getDb, cachedQuery } from '../db';

export interface SeasonSlug {
  slug: string;
  displayName: string;
}

export interface Season {
  seasonID: number;
  displayName: string;
  romanNumeral: string;
  year: number;
  period: string;
  slug: string;
}

export interface StandingsRow {
  teamID: number;
  teamName: string;
  teamSlug: string;
  divisionName: string | null;
  wins: number;
  xp: number;
  totalPts: number;
  lastWeekPts: number | null;
  teamScratchAvg: number | null;
  scratchAvgRank: number;
  teamHcpAvg: number | null;
  hcpAvgRank: number;
}

export interface SeasonLeaderEntry {
  bowlerID: number;
  bowlerName: string;
  slug: string;
  teamName: string | null;
  teamSlug: string | null;
  value: number;
  rank: number;
}

export interface SeasonFullStatsRow {
  bowlerID: number;
  bowlerName: string;
  slug: string;
  gender: string | null;
  teamName: string | null;
  teamSlug: string | null;
  gamesBowled: number;
  totalPins: number;
  scratchAvg: number | null;
  hcpAvg: number | null;
  highGame: number | null;
  highSeries: number | null;
  games200Plus: number;
  series600Plus: number;
  turkeys: number;
}

export interface SeasonScheduleWeek {
  week: number;
  matchDate: string | null;
  homeTeamID: number;
  homeTeamName: string;
  homeTeamSlug: string;
  awayTeamID: number;
  awayTeamName: string;
  awayTeamSlug: string;
}

export interface DirectorySeason {
  seasonID: number;
  displayName: string;
  romanNumeral: string;
  slug: string;
  year: number;
  period: string;
  teamCount: number;
  bowlerCount: number;
  champion: string | null;
}

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

const GET_ALL_SEASON_SLUGS_SQL = `
  SELECT
    LOWER(REPLACE(displayName, ' ', '-')) AS slug,
    displayName
  FROM seasons
  ORDER BY year DESC, CASE period WHEN 'Fall' THEN 2 ELSE 1 END DESC
`;

export async function getAllSeasonSlugs(): Promise<SeasonSlug[]> {
  return cachedQuery('getAllSeasonSlugs', async () => {
    const db = await getDb();
    const result = await db.request().query<SeasonSlug>(GET_ALL_SEASON_SLUGS_SQL);
    return result.recordset;
  }, [], { stable: true, sql: GET_ALL_SEASON_SLUGS_SQL });
}

const GET_SEASON_BY_SLUG_SQL = `
  SELECT
    seasonID,
    displayName,
    romanNumeral,
    year,
    period,
    LOWER(REPLACE(displayName, ' ', '-')) AS slug
  FROM seasons
  WHERE LOWER(REPLACE(displayName, ' ', '-')) = @slug
`;

export const getSeasonBySlug = cache(async (slug: string): Promise<Season | null> => {
  return cachedQuery(`getSeasonBySlug-${slug}`, async () => {
    const db = await getDb();
    const result = await db
      .request()
      .input('slug', slug)
      .query<Season>(GET_SEASON_BY_SLUG_SQL);
    return result.recordset[0] ?? null;
  }, null, { stable: true, sql: GET_SEASON_BY_SLUG_SQL });
});

const GET_SEASON_STANDINGS_SQL = `
  WITH teamAvgs AS (
    SELECT
      sc.teamID,
      CAST(
        SUM(sc.scratchSeries) * 1.0 /
        NULLIF(COUNT(sc.scoreID) * 3, 0)
      AS DECIMAL(5,1))                     AS teamScratchAvg,
      CAST(
        SUM(sc.handSeries) * 1.0 /
        NULLIF(COUNT(sc.scoreID) * 3, 0)
      AS DECIMAL(5,1))                     AS teamHcpAvg
    FROM scores sc
    WHERE sc.seasonID = @seasonID
      AND sc.isPenalty = 0
      AND sc.teamID IS NOT NULL
    GROUP BY sc.teamID
  ),
  teamPtsUnpivot AS (
    SELECT sch.team1ID AS teamID,
           mr.team1GamePts AS gamePts,
           mr.team1BonusPts AS bonusPts,
           sch.week
    FROM matchResults mr
    JOIN schedule sch ON mr.scheduleID = sch.scheduleID
    WHERE sch.seasonID = @seasonID
    UNION ALL
    SELECT sch.team2ID AS teamID,
           mr.team2GamePts AS gamePts,
           mr.team2BonusPts AS bonusPts,
           sch.week
    FROM matchResults mr
    JOIN schedule sch ON mr.scheduleID = sch.scheduleID
    WHERE sch.seasonID = @seasonID
  ),
  teamWinsXP AS (
    SELECT
      teamID,
      SUM(gamePts)  AS wins,
      SUM(bonusPts) AS xp
    FROM teamPtsUnpivot
    GROUP BY teamID
  ),
  maxWeek AS (
    SELECT MAX(week) AS lastWeek FROM teamPtsUnpivot
  ),
  lastWeekPts AS (
    SELECT
      tp.teamID,
      SUM(tp.gamePts) + SUM(tp.bonusPts) AS pts
    FROM teamPtsUnpivot tp
    CROSS JOIN maxWeek mw
    WHERE tp.week = mw.lastWeek
    GROUP BY tp.teamID
  )
  SELECT
    t.teamID,
    COALESCE(tnh.teamName, t.teamName)     AS teamName,
    t.slug                                  AS teamSlug,
    sd.divisionName,
    ISNULL(wx.wins, 0)                      AS wins,
    ISNULL(wx.xp, 0)                        AS xp,
    ISNULL(wx.wins, 0) + ISNULL(wx.xp, 0)  AS totalPts,
    lw.pts                                   AS lastWeekPts,
    ta.teamScratchAvg,
    CAST(RANK() OVER (ORDER BY ta.teamScratchAvg DESC) AS INT) AS scratchAvgRank,
    ta.teamHcpAvg,
    CAST(RANK() OVER (ORDER BY ta.teamHcpAvg DESC) AS INT)     AS hcpAvgRank
  FROM teamAvgs ta
  JOIN teams t ON ta.teamID = t.teamID
  LEFT JOIN teamWinsXP wx ON wx.teamID = ta.teamID
  LEFT JOIN lastWeekPts lw ON lw.teamID = ta.teamID
  LEFT JOIN seasonDivisions sd
    ON  sd.seasonID = @seasonID
    AND sd.teamID   = ta.teamID
  LEFT JOIN teamNameHistory tnh
    ON  tnh.seasonID = @seasonID
    AND tnh.teamID   = ta.teamID
  ORDER BY sd.divisionName, totalPts DESC, wins DESC, ta.teamScratchAvg DESC
`;

export async function getSeasonStandings(seasonID: number): Promise<StandingsRow[]> {
  return cachedQuery(`getSeasonStandings-${seasonID}`, async () => {
    const db = await getDb();
    const result = await db
      .request()
      .input('seasonID', seasonID)
      .query<StandingsRow>(GET_SEASON_STANDINGS_SQL);
    return result.recordset;
  }, [], { sql: GET_SEASON_STANDINGS_SQL });
}

const GET_PLAYOFF_TEAM_IDS_SQL = `
  SELECT DISTINCT teamID FROM (
    SELECT team1ID AS teamID FROM playoffResults WHERE seasonID = @seasonID
    UNION
    SELECT team2ID AS teamID FROM playoffResults WHERE seasonID = @seasonID
  ) t
`;

export const getPlayoffTeamIDs = cache(async (seasonID: number): Promise<Set<number> | null> => {
  const ids = await cachedQuery(`getPlayoffTeamIDs-${seasonID}`, async () => {
    const db = await getDb();
    const result = await db
      .request()
      .input('seasonID', seasonID)
      .query<{ teamID: number }>(GET_PLAYOFF_TEAM_IDS_SQL);
    if (result.recordset.length === 0) return null;
    return result.recordset.map(r => r.teamID);
  }, null, { stable: true, sql: GET_PLAYOFF_TEAM_IDS_SQL });
  return ids ? new Set(ids) : null;
});

export function getMinGamesForWeek(week: number): number {
  const minByWeek = [3, 3, 6, 6, 9, 9, 12, 15, 18];
  return minByWeek[Math.min(week - 1, minByWeek.length - 1)] ?? 3;
}

export async function getSeasonLeaderboard(
  seasonID: number,
  gender: 'M' | 'F' | null,
  category: 'avg' | 'highGame' | 'highSeries' | 'totalPins' | 'games200' | 'series600' | 'turkeys' | 'hcpAvg' | 'hcpHighSeries',
  minGames?: number
): Promise<SeasonLeaderEntry[]> {
  const genderFilter = gender !== null
    ? 'AND b.gender = @gender'
    : '';

  let selectExpr: string;
  let havingClause = '';
  const orderDir = 'DESC';

  const minNights = minGames ? Math.ceil(minGames / 3) : 3;

  switch (category) {
    case 'avg':
      selectExpr = `CAST(SUM(sc.scratchSeries) * 1.0 / NULLIF(COUNT(sc.scoreID) * 3, 0) AS DECIMAL(5,1))`;
      havingClause = `HAVING COUNT(sc.scoreID) >= ${minNights}`;
      break;
    case 'highGame':
      selectExpr = `MAX(
        CASE
          WHEN sc.game1 >= sc.game2 AND sc.game1 >= sc.game3 THEN sc.game1
          WHEN sc.game2 >= sc.game3 THEN sc.game2
          ELSE sc.game3
        END
      )`;
      break;
    case 'highSeries':
      selectExpr = `MAX(sc.scratchSeries)`;
      break;
    case 'totalPins':
      selectExpr = `SUM(sc.scratchSeries)`;
      break;
    case 'games200':
      selectExpr = `SUM(
        CASE WHEN sc.game1 >= 200 THEN 1 ELSE 0 END +
        CASE WHEN sc.game2 >= 200 THEN 1 ELSE 0 END +
        CASE WHEN sc.game3 >= 200 THEN 1 ELSE 0 END
      )`;
      break;
    case 'series600':
      selectExpr = `SUM(CASE WHEN sc.scratchSeries >= 600 THEN 1 ELSE 0 END)`;
      break;
    case 'turkeys':
      selectExpr = `SUM(ISNULL(sc.turkeys, 0))`;
      break;
    case 'hcpAvg':
      selectExpr = `CAST(SUM(sc.handSeries) * 1.0 / NULLIF(COUNT(sc.scoreID) * 3, 0) AS DECIMAL(5,1))`;
      havingClause = `HAVING COUNT(sc.scoreID) >= ${minNights}`;
      break;
    case 'hcpHighSeries':
      selectExpr = `MAX(sc.handSeries)`;
      break;
  }

  const sql = `
    SELECT TOP 10
      agg.bowlerID,
      b.bowlerName,
      b.slug,
      COALESCE(tnh.teamName, t.teamName) AS teamName,
      t.slug AS teamSlug,
      agg.value,
      ROW_NUMBER() OVER (ORDER BY agg.value ${orderDir}) AS rank
    FROM (
      SELECT sc.bowlerID,
        ${selectExpr} AS value
      FROM scores sc
      JOIN bowlers b ON sc.bowlerID = b.bowlerID
      WHERE sc.seasonID = @seasonID
        AND sc.isPenalty = 0
        ${genderFilter}
      GROUP BY sc.bowlerID
      ${havingClause}
    ) agg
    JOIN bowlers b ON b.bowlerID = agg.bowlerID
    CROSS APPLY (
      SELECT TOP 1 sc2.teamID
      FROM scores sc2
      WHERE sc2.bowlerID = agg.bowlerID AND sc2.seasonID = @seasonID AND sc2.isPenalty = 0
      GROUP BY sc2.teamID
      ORDER BY COUNT(*) DESC
    ) pt
    LEFT JOIN teams t ON t.teamID = pt.teamID
    LEFT JOIN teamNameHistory tnh
      ON  tnh.seasonID = @seasonID
      AND tnh.teamID   = pt.teamID
    ORDER BY agg.value ${orderDir}
  `;

  return cachedQuery(`getSeasonLeaderboard-${seasonID}-${gender}-${category}-${minGames}`, async () => {
    const db = await getDb();
    const request = db.request().input('seasonID', seasonID);
    if (gender !== null) {
      request.input('gender', gender);
    }
    const result = await request.query<SeasonLeaderEntry>(sql);
    return result.recordset;
  }, [], { sql });
}

const GET_SEASON_FULL_STATS_SQL = `
  SELECT
    agg.bowlerID,
    b.bowlerName,
    b.slug,
    b.gender,
    COALESCE(tnh.teamName, t.teamName)                   AS teamName,
    t.slug                                               AS teamSlug,
    agg.gamesBowled,
    agg.totalPins,
    agg.scratchAvg,
    agg.hcpAvg,
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
      AS DECIMAL(5,1))                                     AS scratchAvg,
      CAST(
        SUM(sc.handSeries) * 1.0 /
        NULLIF(COUNT(sc.scoreID) * 3, 0)
      AS DECIMAL(5,1))                                     AS hcpAvg,
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
    WHERE sc.seasonID = @seasonID
      AND sc.isPenalty = 0
    GROUP BY sc.bowlerID
  ) agg
  JOIN bowlers b ON b.bowlerID = agg.bowlerID
  CROSS APPLY (
    SELECT TOP 1 sc2.teamID
    FROM scores sc2
    WHERE sc2.bowlerID = agg.bowlerID AND sc2.seasonID = @seasonID AND sc2.isPenalty = 0
    GROUP BY sc2.teamID
    ORDER BY COUNT(*) DESC
  ) pt
  LEFT JOIN teams t ON t.teamID = pt.teamID
  LEFT JOIN teamNameHistory tnh
    ON  tnh.seasonID = @seasonID
    AND tnh.teamID   = pt.teamID
  ORDER BY scratchAvg DESC
`;

export async function getSeasonFullStats(seasonID: number): Promise<SeasonFullStatsRow[]> {
  return cachedQuery(`getSeasonFullStats-${seasonID}`, async () => {
    const db = await getDb();
    const result = await db
      .request()
      .input('seasonID', seasonID)
      .query<SeasonFullStatsRow>(GET_SEASON_FULL_STATS_SQL);
    return result.recordset;
  }, [], { sql: GET_SEASON_FULL_STATS_SQL });
}

const GET_SEASON_SCHEDULE_SQL = `
  SELECT
    sch.week,
    sch.matchDate,
    sch.team1ID                                          AS homeTeamID,
    COALESCE(tnh1.teamName, t1.teamName)                 AS homeTeamName,
    t1.slug                                              AS homeTeamSlug,
    sch.team2ID                                          AS awayTeamID,
    COALESCE(tnh2.teamName, t2.teamName)                 AS awayTeamName,
    t2.slug                                              AS awayTeamSlug
  FROM schedule sch
  JOIN teams t1 ON sch.team1ID = t1.teamID
  JOIN teams t2 ON sch.team2ID = t2.teamID
  LEFT JOIN teamNameHistory tnh1
    ON  tnh1.seasonID = sch.seasonID
    AND tnh1.teamID   = sch.team1ID
  LEFT JOIN teamNameHistory tnh2
    ON  tnh2.seasonID = sch.seasonID
    AND tnh2.teamID   = sch.team2ID
  WHERE sch.seasonID = @seasonID
  ORDER BY sch.week ASC, sch.matchNumber ASC
`;

export async function getSeasonSchedule(seasonID: number): Promise<SeasonScheduleWeek[]> {
  return cachedQuery(`getSeasonSchedule-${seasonID}`, async () => {
    const db = await getDb();
    const result = await db
      .request()
      .input('seasonID', seasonID)
      .query<SeasonScheduleWeek>(GET_SEASON_SCHEDULE_SQL);
    return result.recordset;
  }, [], { stable: true, sql: GET_SEASON_SCHEDULE_SQL });
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
  }, empty, { sql: RECORDS_ALL_SQL });
}

const GET_ALL_SEASONS_DIRECTORY_SQL = `
  SELECT
    sn.seasonID,
    sn.displayName,
    sn.romanNumeral,
    LOWER(REPLACE(sn.displayName, ' ', '-'))   AS slug,
    sn.year,
    sn.period,
    COUNT(DISTINCT sc.teamID)                  AS teamCount,
    COUNT(DISTINCT sc.bowlerID)                AS bowlerCount,
    champ.winnerTeamName                       AS champion
  FROM seasons sn
  LEFT JOIN scores sc
    ON  sc.seasonID = sn.seasonID
    AND sc.isPenalty = 0
  LEFT JOIN (
    SELECT sc2.seasonID, t.teamName AS winnerTeamName
    FROM seasonChampions sc2
    JOIN teams t ON sc2.winnerTeamID = t.teamID
    WHERE sc2.championshipType = 'Team'
  ) champ ON champ.seasonID = sn.seasonID
  GROUP BY
    sn.seasonID, sn.displayName, sn.romanNumeral,
    sn.year, sn.period, champ.winnerTeamName
  ORDER BY sn.year DESC, CASE sn.period WHEN 'Fall' THEN 2 ELSE 1 END DESC
`;

export const getAllSeasonsDirectory = cache(async (): Promise<DirectorySeason[]> => {
  return cachedQuery('getAllSeasonsDirectory', async () => {
    const db = await getDb();
    const result = await db.request().query<DirectorySeason>(GET_ALL_SEASONS_DIRECTORY_SQL);
    return result.recordset;
  }, [], { sql: GET_ALL_SEASONS_DIRECTORY_SQL });
});

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
  }, null, { sql: HERO_ALL_SQL });
}

export interface PlayoffMatchup {
  winnerName: string;
  winnerSlug: string;
  winnerSeed: number | null;
  loserName: string;
  loserSlug: string;
  loserSeed: number | null;
}

export interface SeasonPlayoffBracket {
  final: PlayoffMatchup;
  semi1: PlayoffMatchup | null;
  semi2: PlayoffMatchup | null;
}

const PLAYOFF_SEEDS_CTE = `
  WITH teamPtsUnpivot AS (
    SELECT sch.team1ID AS teamID, mr.team1GamePts AS gamePts, mr.team1BonusPts AS bonusPts
    FROM matchResults mr
    JOIN schedule sch ON mr.scheduleID = sch.scheduleID
    WHERE sch.seasonID = @seasonID
    UNION ALL
    SELECT sch.team2ID AS teamID, mr.team2GamePts AS gamePts, mr.team2BonusPts AS bonusPts
    FROM matchResults mr
    JOIN schedule sch ON mr.scheduleID = sch.scheduleID
    WHERE sch.seasonID = @seasonID
  ),
  seeds AS (
    SELECT teamID,
           ROW_NUMBER() OVER (ORDER BY SUM(gamePts) + SUM(bonusPts) DESC) AS seed
    FROM teamPtsUnpivot
    GROUP BY teamID
  )`;

const PLAYOFF_FINAL_SQL = `
  ${PLAYOFF_SEEDS_CTE}
  SELECT
    COALESCE(hc.teamName, tc.teamName) AS champName, tc.slug AS champSlug, sc.seed AS champSeed,
    COALESCE(hr.teamName, tr.teamName) AS ruName, tr.slug AS ruSlug, sr.seed AS ruSeed
  FROM playoffResults pr
  JOIN teams tc ON pr.team1ID = tc.teamID
  JOIN teams tr ON pr.team2ID = tr.teamID
  LEFT JOIN teamNameHistory hc ON hc.seasonID = pr.seasonID AND hc.teamID = pr.team1ID
  LEFT JOIN teamNameHistory hr ON hr.seasonID = pr.seasonID AND hr.teamID = pr.team2ID
  LEFT JOIN seeds sc ON sc.teamID = pr.team1ID
  LEFT JOIN seeds sr ON sr.teamID = pr.team2ID
  WHERE pr.seasonID = @seasonID AND pr.playoffType = 'Team' AND pr.round = 'final'
`;

const PLAYOFF_SEMI_SQL = `
  ${PLAYOFF_SEEDS_CTE}
  SELECT
    COALESCE(hl.teamName, tl.teamName) AS loserName, tl.slug AS loserSlug, sl.seed AS loserSeed,
    COALESCE(hw.teamName, tw.teamName) AS winnerName, tw.slug AS winnerSlug, sw.seed AS winnerSeed
  FROM playoffResults pr
  JOIN teams tl ON pr.team1ID = tl.teamID
  LEFT JOIN teams tw ON pr.winnerTeamID = tw.teamID
  LEFT JOIN teamNameHistory hl ON hl.seasonID = pr.seasonID AND hl.teamID = pr.team1ID
  LEFT JOIN teamNameHistory hw ON hw.seasonID = pr.seasonID AND hw.teamID = pr.winnerTeamID
  LEFT JOIN seeds sl ON sl.teamID = pr.team1ID
  LEFT JOIN seeds sw ON sw.teamID = pr.winnerTeamID
  WHERE pr.seasonID = @seasonID AND pr.playoffType = 'Team' AND pr.round = 'semifinal'
  ORDER BY pr.playoffID
`;

const PLAYOFF_ALL_SQL = PLAYOFF_FINAL_SQL + PLAYOFF_SEMI_SQL;

export const getSeasonPlayoffBracket = cache(async (seasonID: number): Promise<SeasonPlayoffBracket | null> => {
  return cachedQuery(`getSeasonPlayoffBracket-${seasonID}`, async () => {

    const db = await getDb();

    const finalResult = await db.request()
      .input('seasonID', seasonID)
      .query<{
        champName: string; champSlug: string; champSeed: number | null;
        ruName: string; ruSlug: string; ruSeed: number | null;
      }>(PLAYOFF_FINAL_SQL);
    if (finalResult.recordset.length === 0) return null;
    const f = finalResult.recordset[0];

    const semiResult = await db.request()
      .input('seasonID', seasonID)
      .query<{
        loserName: string; loserSlug: string; loserSeed: number | null;
        winnerName: string | null; winnerSlug: string | null; winnerSeed: number | null;
      }>(PLAYOFF_SEMI_SQL);

    const semis = semiResult.recordset;

    function buildMatchup(
      wName: string, wSlug: string, wSeed: number | null,
      lName: string, lSlug: string, lSeed: number | null,
    ): PlayoffMatchup {
      return { winnerName: wName, winnerSlug: wSlug, winnerSeed: wSeed, loserName: lName, loserSlug: lSlug, loserSeed: lSeed };
    }

    return {
      final: buildMatchup(f.champName, f.champSlug, f.champSeed, f.ruName, f.ruSlug, f.ruSeed),
      semi1: semis[0]?.winnerName ? buildMatchup(
        semis[0].winnerName, semis[0].winnerSlug!, semis[0].winnerSeed,
        semis[0].loserName, semis[0].loserSlug, semis[0].loserSeed,
      ) : (semis[0] ? buildMatchup(
        '', '', null,
        semis[0].loserName, semis[0].loserSlug, semis[0].loserSeed,
      ) : null),
      semi2: semis[1]?.winnerName ? buildMatchup(
        semis[1].winnerName, semis[1].winnerSlug!, semis[1].winnerSeed,
        semis[1].loserName, semis[1].loserSlug, semis[1].loserSeed,
      ) : (semis[1] ? buildMatchup(
        '', '', null,
        semis[1].loserName, semis[1].loserSlug, semis[1].loserSeed,
      ) : null),
    };
  }, null, { stable: true, sql: PLAYOFF_ALL_SQL });
});

/* ───────────────────────────────────────────────────────────
 * Weekly Match Scores & Results
 * ─────────────────────────────────────────────────────────── */

export interface WeeklyMatchScore {
  week: number;
  matchDate: string | null;
  teamID: number;
  teamName: string;
  teamSlug: string;
  bowlerID: number;
  bowlerName: string;
  bowlerSlug: string;
  game1: number | null;
  game2: number | null;
  game3: number | null;
  scratchSeries: number | null;
  handSeries: number | null;
  incomingAvg: number | null;
  incomingHcp: number | null;
  turkeys: number;
  gender: string | null;
  isFirstNight: boolean;
  priorBestGame: number | null;
  priorBestSeries: number | null;
}

const GET_SEASON_WEEKLY_SCORES_SQL = `
  SELECT
    sc.week,
    sch.matchDate,
    sc.teamID,
    COALESCE(tnh.teamName, t.teamName)  AS teamName,
    t.slug                               AS teamSlug,
    sc.bowlerID,
    b.bowlerName,
    b.slug                               AS bowlerSlug,
    sc.game1,
    sc.game2,
    sc.game3,
    sc.scratchSeries,
    sc.handSeries,
    sc.incomingAvg,
    sc.incomingHcp,
    ISNULL(sc.turkeys, 0) AS turkeys,
    b.gender,
    CASE WHEN NOT EXISTS (
      SELECT 1 FROM scores sc3
      WHERE sc3.bowlerID = sc.bowlerID
        AND sc3.isPenalty = 0
        AND (sc3.seasonID < sc.seasonID OR (sc3.seasonID = sc.seasonID AND sc3.week < sc.week))
    ) THEN 1 ELSE 0 END AS isFirstNight,
    (SELECT MAX(x.val) FROM scores sp
      CROSS APPLY (VALUES (sp.game1),(sp.game2),(sp.game3)) AS x(val)
      WHERE sp.bowlerID = sc.bowlerID AND sp.isPenalty = 0
        AND (sp.seasonID < sc.seasonID OR (sp.seasonID = sc.seasonID AND sp.week < sc.week))
    ) AS priorBestGame,
    (SELECT MAX(sp.scratchSeries) FROM scores sp
      WHERE sp.bowlerID = sc.bowlerID AND sp.isPenalty = 0
        AND (sp.seasonID < sc.seasonID OR (sp.seasonID = sc.seasonID AND sp.week < sc.week))
    ) AS priorBestSeries
  FROM scores sc
  JOIN bowlers b ON sc.bowlerID = b.bowlerID
  JOIN teams t ON sc.teamID = t.teamID
  LEFT JOIN teamNameHistory tnh
    ON  tnh.seasonID = sc.seasonID
    AND tnh.teamID   = sc.teamID
  LEFT JOIN (
    SELECT seasonID, week, MIN(matchDate) AS matchDate
    FROM schedule
    GROUP BY seasonID, week
  ) sch
    ON  sch.seasonID = sc.seasonID
    AND sch.week     = sc.week
  WHERE sc.seasonID = @seasonID
    AND sc.isPenalty = 0
  ORDER BY sc.week ASC, sc.teamID ASC, b.bowlerName ASC
`;

export async function getSeasonWeeklyScores(seasonID: number): Promise<WeeklyMatchScore[]> {
  return cachedQuery(`getSeasonWeeklyScores-${seasonID}`, async () => {

      const db = await getDb();
      const result = await db
        .request()
        .input('seasonID', seasonID)
        .query<WeeklyMatchScore>(GET_SEASON_WEEKLY_SCORES_SQL);
      return result.recordset;
  }, [], { sql: GET_SEASON_WEEKLY_SCORES_SQL });
}

export interface WeeklyMatchupResult {
  week: number;
  homeTeamID: number;
  awayTeamID: number;
  team1Game1: number | null;
  team1Game2: number | null;
  team1Game3: number | null;
  team1Series: number | null;
  team2Game1: number | null;
  team2Game2: number | null;
  team2Game3: number | null;
  team2Series: number | null;
  team1GamePts: number | null;
  team2GamePts: number | null;
  team1BonusPts: number | null;
  team2BonusPts: number | null;
}

const GET_SEASON_MATCH_RESULTS_SQL = `
  SELECT
    sch.week,
    sch.team1ID AS homeTeamID,
    sch.team2ID AS awayTeamID,
    mr.team1Game1,
    mr.team1Game2,
    mr.team1Game3,
    mr.team1Series,
    mr.team2Game1,
    mr.team2Game2,
    mr.team2Game3,
    mr.team2Series,
    mr.team1GamePts,
    mr.team2GamePts,
    mr.team1BonusPts,
    mr.team2BonusPts
  FROM matchResults mr
  JOIN schedule sch ON mr.scheduleID = sch.scheduleID
  WHERE sch.seasonID = @seasonID
  ORDER BY sch.week ASC
`;

export async function getSeasonMatchResults(seasonID: number): Promise<WeeklyMatchupResult[]> {
  return cachedQuery(`getSeasonMatchResults-${seasonID}`, async () => {
    const db = await getDb();
    const result = await db
      .request()
      .input('seasonID', seasonID)
      .query<WeeklyMatchupResult>(GET_SEASON_MATCH_RESULTS_SQL);
    return result.recordset;
  }, [], { sql: GET_SEASON_MATCH_RESULTS_SQL });
}

export interface RaceChartRow {
  week: number;
  teamID: number;
  teamName: string;
  totalPts: number;
}

const GET_STANDINGS_RACE_DATA_SQL = `
  WITH weeklyPts AS (
    SELECT sch.week,
           sch.team1ID AS teamID,
           mr.team1GamePts + mr.team1BonusPts AS pts
    FROM matchResults mr
    JOIN schedule sch ON mr.scheduleID = sch.scheduleID
    WHERE sch.seasonID = @seasonID
    UNION ALL
    SELECT sch.week,
           sch.team2ID AS teamID,
           mr.team2GamePts + mr.team2BonusPts AS pts
    FROM matchResults mr
    JOIN schedule sch ON mr.scheduleID = sch.scheduleID
    WHERE sch.seasonID = @seasonID
  ),
  cumulative AS (
    SELECT
      w1.teamID,
      w1.week,
      SUM(w2.pts) AS totalPts
    FROM (SELECT DISTINCT teamID, week FROM weeklyPts) w1
    JOIN weeklyPts w2 ON w2.teamID = w1.teamID AND w2.week <= w1.week
    GROUP BY w1.teamID, w1.week
  )
  SELECT
    c.week,
    c.teamID,
    COALESCE(tnh.teamName, t.teamName) AS teamName,
    c.totalPts
  FROM cumulative c
  JOIN teams t ON c.teamID = t.teamID
  LEFT JOIN teamNameHistory tnh
    ON tnh.seasonID = @seasonID AND tnh.teamID = c.teamID
  ORDER BY c.week, c.totalPts DESC
`;

export async function getStandingsRaceData(seasonID: number): Promise<RaceChartRow[]> {
  return cachedQuery(`getStandingsRaceData-${seasonID}`, async () => {
    const db = await getDb();
    const result = await db.request().input('seasonID', seasonID).query<RaceChartRow>(GET_STANDINGS_RACE_DATA_SQL);
    return result.recordset;
  }, [], { sql: GET_STANDINGS_RACE_DATA_SQL });
}

/* ───────────────────────────────────────────────────────────
 * Season Navigation & Week Summaries
 * ─────────────────────────────────────────────────────────── */

export interface SeasonNav {
  seasonID: number;
  slug: string;
  romanNumeral: string;
  displayName: string;
  year: number;
  period: string;
}

const GET_ALL_SEASON_NAV_LIST_SQL = `
  SELECT
    seasonID,
    LOWER(REPLACE(displayName, ' ', '-')) AS slug,
    romanNumeral,
    displayName,
    year,
    period
  FROM seasons
  ORDER BY year DESC, CASE period WHEN 'Fall' THEN 2 ELSE 1 END DESC
`;

export const getAllSeasonNavList = cache(async (): Promise<SeasonNav[]> => {
  return cachedQuery('getAllSeasonNavList', async () => {
    const db = await getDb();
    const result = await db.request().query<SeasonNav>(GET_ALL_SEASON_NAV_LIST_SQL);
    return result.recordset;
  }, [], { stable: true, sql: GET_ALL_SEASON_NAV_LIST_SQL });
});

export async function getCurrentSeasonSlug(): Promise<string | undefined> {
  const seasons = await getAllSeasonNavList();
  return seasons[0]?.slug;
}

export interface WeekSummary {
  week: number;
  matchDate: string | null;
  matchCount: number;
  highGame: number | null;
  highGameBowler: string | null;
  highGameSlug: string | null;
  highSeries: number | null;
  highSeriesBowler: string | null;
  highSeriesSlug: string | null;
  leagueAvg: number | null;
  expectedAvg: number | null;
  botwName: string | null;
  botwSlug: string | null;
  botwPinsOver: number | null;
}

const GET_SEASON_WEEK_SUMMARIES_SQL = `
  WITH weekStats AS (
    SELECT
      sc.week,
      MIN(sch.matchDate) AS matchDate,
      COUNT(DISTINCT sch.scheduleID) AS matchCount,
      MAX(CASE WHEN sc.game1 >= ISNULL(sc.game2, 0) AND sc.game1 >= ISNULL(sc.game3, 0) THEN sc.game1
               WHEN sc.game2 >= ISNULL(sc.game1, 0) AND sc.game2 >= ISNULL(sc.game3, 0) THEN sc.game2
               ELSE sc.game3 END) AS highGame,
      MAX(sc.scratchSeries) AS highSeries,
      CAST(SUM(sc.scratchSeries) * 1.0 / NULLIF(COUNT(sc.scoreID) * 3, 0) AS DECIMAL(5,1)) AS leagueAvg,
      CAST(AVG(CASE WHEN sc.incomingAvg > 0 THEN CAST(sc.incomingAvg AS DECIMAL(5,1)) END) AS DECIMAL(5,1)) AS expectedAvg
    FROM scores sc
    LEFT JOIN schedule sch ON sch.seasonID = sc.seasonID AND sch.week = sc.week
    WHERE sc.seasonID = @seasonID AND sc.isPenalty = 0
    GROUP BY sc.week
  ),
  highGameBowler AS (
    SELECT sc.week, b.bowlerName, b.slug,
      ROW_NUMBER() OVER (PARTITION BY sc.week ORDER BY
        CASE WHEN sc.game1 >= ISNULL(sc.game2, 0) AND sc.game1 >= ISNULL(sc.game3, 0) THEN sc.game1
             WHEN sc.game2 >= ISNULL(sc.game1, 0) AND sc.game2 >= ISNULL(sc.game3, 0) THEN sc.game2
             ELSE sc.game3 END DESC) AS rn
    FROM scores sc
    JOIN bowlers b ON sc.bowlerID = b.bowlerID
    WHERE sc.seasonID = @seasonID AND sc.isPenalty = 0
  ),
  highSeriesBowler AS (
    SELECT sc.week, b.bowlerName, b.slug,
      ROW_NUMBER() OVER (PARTITION BY sc.week ORDER BY sc.scratchSeries DESC) AS rn
    FROM scores sc
    JOIN bowlers b ON sc.bowlerID = b.bowlerID
    WHERE sc.seasonID = @seasonID AND sc.isPenalty = 0
  ),
  botwCTE AS (
    SELECT sc.week, b.bowlerName, b.slug,
      sc.scratchSeries - 3 * sc.incomingAvg AS pinsOver,
      ROW_NUMBER() OVER (PARTITION BY sc.week ORDER BY sc.scratchSeries - 3 * sc.incomingAvg DESC) AS rn
    FROM scores sc
    JOIN bowlers b ON sc.bowlerID = b.bowlerID
    WHERE sc.seasonID = @seasonID AND sc.isPenalty = 0
      AND sc.incomingAvg IS NOT NULL AND sc.incomingAvg > 0
      AND EXISTS (
        SELECT 1 FROM scores sc3
        WHERE sc3.bowlerID = sc.bowlerID AND sc3.isPenalty = 0
          AND (sc3.seasonID < sc.seasonID OR (sc3.seasonID = sc.seasonID AND sc3.week < sc.week))
      )
  )
  SELECT
    ws.week,
    ws.matchDate,
    ws.matchCount,
    ws.highGame,
    hg.bowlerName AS highGameBowler,
    hg.slug AS highGameSlug,
    ws.highSeries,
    hs.bowlerName AS highSeriesBowler,
    hs.slug AS highSeriesSlug,
    ws.leagueAvg,
    ws.expectedAvg,
    bw.bowlerName AS botwName,
    bw.slug AS botwSlug,
    bw.pinsOver AS botwPinsOver
  FROM weekStats ws
  LEFT JOIN highGameBowler hg ON hg.week = ws.week AND hg.rn = 1
  LEFT JOIN highSeriesBowler hs ON hs.week = ws.week AND hs.rn = 1
  LEFT JOIN botwCTE bw ON bw.week = ws.week AND bw.rn = 1
  ORDER BY ws.week DESC
`;

export async function getSeasonWeekSummaries(seasonID: number): Promise<WeekSummary[]> {
  return cachedQuery(`getSeasonWeekSummaries-${seasonID}`, async () => {
    const db = await getDb();
    const result = await db
      .request()
      .input('seasonID', seasonID)
      .query<WeekSummary>(GET_SEASON_WEEK_SUMMARIES_SQL);
    return result.recordset;
  }, [], { sql: GET_SEASON_WEEK_SUMMARIES_SQL });
}

/* ─────────────────────────────────────────────────────────
 * Playoff / Championship History
 * ───────────────────────────────────────────────────────── */

export interface PlayoffSeason {
  seasonID: number;
  romanNumeral: string;
  displayName: string;
  championTeamID: number;
  championName: string;
  championHistoricName: string | null;
  runnerUpTeamID: number;
  runnerUpName: string;
  runnerUpHistoricName: string | null;
  semi1TeamID: number | null;
  semi1Name: string | null;
  semi1HistoricName: string | null;
  semi2TeamID: number | null;
  semi2Name: string | null;
  semi2HistoricName: string | null;
}

const GET_ALL_PLAYOFF_HISTORY_SQL = `
  WITH finals AS (
    SELECT seasonID, team1ID AS championTeamID, team2ID AS runnerUpTeamID
    FROM playoffResults
    WHERE playoffType = 'Team' AND round = 'final'
  ),
  semis AS (
    SELECT seasonID, team1ID AS semiTeamID,
           ROW_NUMBER() OVER (PARTITION BY seasonID ORDER BY playoffID) AS rn
    FROM playoffResults
    WHERE playoffType = 'Team' AND round = 'semifinal'
  )
  SELECT
    s.seasonID,
    s.romanNumeral,
    s.displayName,
    f.championTeamID,
    tc.teamName             AS championName,
    thc.teamName            AS championHistoricName,
    f.runnerUpTeamID,
    tr.teamName             AS runnerUpName,
    thr.teamName            AS runnerUpHistoricName,
    s1.semiTeamID           AS semi1TeamID,
    ts1.teamName            AS semi1Name,
    ths1.teamName           AS semi1HistoricName,
    s2.semiTeamID           AS semi2TeamID,
    ts2.teamName            AS semi2Name,
    ths2.teamName           AS semi2HistoricName
  FROM seasons s
  JOIN finals f ON f.seasonID = s.seasonID
  JOIN teams tc ON f.championTeamID = tc.teamID
  JOIN teams tr ON f.runnerUpTeamID = tr.teamID
  LEFT JOIN semis s1 ON s1.seasonID = s.seasonID AND s1.rn = 1
  LEFT JOIN teams ts1 ON s1.semiTeamID = ts1.teamID
  LEFT JOIN semis s2 ON s2.seasonID = s.seasonID AND s2.rn = 2
  LEFT JOIN teams ts2 ON s2.semiTeamID = ts2.teamID
  LEFT JOIN teamNameHistory thc ON thc.seasonID = s.seasonID AND thc.teamID = f.championTeamID
  LEFT JOIN teamNameHistory thr ON thr.seasonID = s.seasonID AND thr.teamID = f.runnerUpTeamID
  LEFT JOIN teamNameHistory ths1 ON ths1.seasonID = s.seasonID AND ths1.teamID = s1.semiTeamID
  LEFT JOIN teamNameHistory ths2 ON ths2.seasonID = s.seasonID AND ths2.teamID = s2.semiTeamID
  ORDER BY s.seasonID DESC
`;

export const getAllPlayoffHistory = cache(async (): Promise<PlayoffSeason[]> => {
  return cachedQuery('getAllPlayoffHistory', async () => {
    const db = await getDb();
    const result = await db.request().query<PlayoffSeason>(GET_ALL_PLAYOFF_HISTORY_SQL);
    return result.recordset;
  }, [], { stable: true, sql: GET_ALL_PLAYOFF_HISTORY_SQL });
});

/* ─────────────────────────────────────────────────────────
 * Individual Championship History
 * ───────────────────────────────────────────────────────── */

export interface IndividualChampionSeason {
  seasonID: number;
  romanNumeral: string;
  displayName: string;
  mensScratchName: string | null;
  mensScratchSlug: string | null;
  womensScratchName: string | null;
  womensScratchSlug: string | null;
  handicapName: string | null;
  handicapSlug: string | null;
}

const GET_ALL_INDIVIDUAL_CHAMPIONS_SQL = `
  SELECT
    s.seasonID,
    s.romanNumeral,
    s.displayName,
    bm.bowlerName AS mensScratchName, bm.slug AS mensScratchSlug,
    bw.bowlerName AS womensScratchName, bw.slug AS womensScratchSlug,
    bh.bowlerName AS handicapName, bh.slug AS handicapSlug
  FROM seasons s
  LEFT JOIN seasonChampions cm ON cm.seasonID = s.seasonID AND cm.championshipType = 'MensScratch'
  LEFT JOIN bowlers bm ON cm.winnerBowlerID = bm.bowlerID
  LEFT JOIN seasonChampions cw ON cw.seasonID = s.seasonID AND cw.championshipType = 'WomensScratch'
  LEFT JOIN bowlers bw ON cw.winnerBowlerID = bw.bowlerID
  LEFT JOIN seasonChampions ch ON ch.seasonID = s.seasonID AND ch.championshipType = 'Handicap'
  LEFT JOIN bowlers bh ON ch.winnerBowlerID = bh.bowlerID
  WHERE cm.id IS NOT NULL OR cw.id IS NOT NULL OR ch.id IS NOT NULL
  ORDER BY s.seasonID DESC
`;

export const getAllIndividualChampions = cache(async (): Promise<IndividualChampionSeason[]> => {
  return cachedQuery('getAllIndividualChampions', async () => {
    const db = await getDb();
    const result = await db.request().query<IndividualChampionSeason>(GET_ALL_INDIVIDUAL_CHAMPIONS_SQL);
    return result.recordset;
  }, [], { stable: true, sql: GET_ALL_INDIVIDUAL_CHAMPIONS_SQL });
});
