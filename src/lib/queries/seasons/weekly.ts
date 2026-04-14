/**
 * Weekly scores, match results, schedule, and week summary queries.
 */
import { getDb, cachedQuery } from '../../db';

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
  isPenalty: boolean;
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
  botwNames: string[];
  botwSlugs: string[];
  botwHandSeries: number | null;
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
  }, [], { dependsOn: ['schedule'], sql: GET_SEASON_SCHEDULE_SQL, seasonID });
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
    sc.isPenalty,
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
  ORDER BY sc.week ASC, sc.teamID ASC, sc.isPenalty ASC, b.bowlerName ASC
`;

export async function getSeasonWeeklyScores(seasonID: number): Promise<WeeklyMatchScore[]> {
  return cachedQuery(`getSeasonWeeklyScores-${seasonID}`, async () => {

      const db = await getDb();
      const result = await db
        .request()
        .input('seasonID', seasonID)
        .query<WeeklyMatchScore>(GET_SEASON_WEEKLY_SCORES_SQL);
      return result.recordset;
  }, [], { sql: GET_SEASON_WEEKLY_SCORES_SQL, seasonID });
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
  }, [], { sql: GET_SEASON_MATCH_RESULTS_SQL, seasonID });
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
    SELECT sc.week, b.bowlerName, b.slug, sc.handSeries,
      DENSE_RANK() OVER (PARTITION BY sc.week ORDER BY sc.handSeries DESC) AS rnk
    FROM scores sc
    JOIN bowlers b ON sc.bowlerID = b.bowlerID
    WHERE sc.seasonID = @seasonID AND sc.isPenalty = 0
      AND sc.incomingAvg IS NOT NULL AND sc.incomingAvg > 0
  ),
  botwAgg AS (
    SELECT week,
      STRING_AGG(bowlerName, '|') WITHIN GROUP (ORDER BY bowlerName) AS botwNamesJoined,
      STRING_AGG(slug, '|') WITHIN GROUP (ORDER BY bowlerName) AS botwSlugsJoined,
      MAX(handSeries) AS botwHandSeries
    FROM botwCTE
    WHERE rnk = 1
    GROUP BY week
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
    ba.botwNamesJoined,
    ba.botwSlugsJoined,
    ba.botwHandSeries
  FROM weekStats ws
  LEFT JOIN highGameBowler hg ON hg.week = ws.week AND hg.rn = 1
  LEFT JOIN highSeriesBowler hs ON hs.week = ws.week AND hs.rn = 1
  LEFT JOIN botwAgg ba ON ba.week = ws.week
  ORDER BY ws.week DESC
`;

interface WeekSummaryRow extends Omit<WeekSummary, 'botwNames' | 'botwSlugs'> {
  botwNamesJoined: string | null;
  botwSlugsJoined: string | null;
}

export async function getSeasonWeekSummaries(seasonID: number): Promise<WeekSummary[]> {
  return cachedQuery(`getSeasonWeekSummaries-${seasonID}`, async () => {
    const db = await getDb();
    const result = await db
      .request()
      .input('seasonID', seasonID)
      .query<WeekSummaryRow>(GET_SEASON_WEEK_SUMMARIES_SQL);
    return result.recordset.map((row) => {
      const { botwNamesJoined, botwSlugsJoined, ...rest } = row;
      return {
        ...rest,
        botwNames: botwNamesJoined ? botwNamesJoined.split('|') : [],
        botwSlugs: botwSlugsJoined ? botwSlugsJoined.split('|') : [],
      };
    });
  }, [], { sql: GET_SEASON_WEEK_SUMMARIES_SQL, seasonID });
}
