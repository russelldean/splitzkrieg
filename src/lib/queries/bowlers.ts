/**
 * Bowler-related SQL queries.
 * Includes profile, career stats, game log, rolling average, and directory.
 */
import { cache } from 'react';
import { getDb, cachedQuery } from '../db';

export interface BowlerSlug {
  slug: string;
}

export interface Bowler {
  bowlerID: number;
  bowlerName: string;
  slug: string;
  isActive: boolean | null;
}

const GET_ALL_BOWLER_SLUGS_SQL = `
  SELECT slug
  FROM bowlers
  ORDER BY bowlerName
`;

export async function getAllBowlerSlugs(): Promise<BowlerSlug[]> {
  return cachedQuery('getAllBowlerSlugs', async () => {
    const db = await getDb();
    const result = await db.request().query<{ slug: string }>(GET_ALL_BOWLER_SLUGS_SQL);
    return result.recordset;
  }, [], { stable: true, sql: GET_ALL_BOWLER_SLUGS_SQL });
}

const GET_BOWLER_BY_SLUG_SQL = `
  SELECT
    bowlerID,
    bowlerName,
    slug,
    isActive
  FROM bowlers
  WHERE slug = @slug
`;

export async function getBowlerBySlug(slug: string): Promise<Bowler | null> {
  return cachedQuery(`getBowlerBySlug-${slug}`, async () => {
    const db = await getDb();
    const result = await db
      .request()
      .input('slug', slug)
      .query<Bowler>(GET_BOWLER_BY_SLUG_SQL);
    return result.recordset[0] ?? null;
  }, null, { stable: true, sql: GET_BOWLER_BY_SLUG_SQL });
}

/* ───────────────────────────────────────────────────────────
 * Bowler Profile Queries
 * ─────────────────────────────────────────────────────────── */

export interface BowlerCareerSummary {
  bowlerID: number;
  bowlerName: string;
  slug: string;
  gender: string | null;
  isActive: boolean | null;
  totalGamesBowled: number;
  totalPins: number;
  careerAverage: number | null;
  highGame: number | null;
  highSeries: number | null;
  games200Plus: number;
  series600Plus: number;
  totalTurkeys: number;
  firstYear: number | null;
  lastYear: number | null;
  seasonsPlayed: number;
  teamsPlayedFor: number;
  firstMatchDate: string | null;
  rollingAvg: number | null;
  prevRollingAvg: number | null;
}

const GET_BOWLER_CAREER_SUMMARY_SQL = `
  SELECT
    v.*,
    (
      SELECT COUNT(DISTINCT teamID)
      FROM scores
      WHERE bowlerID = @bowlerID
        AND isPenalty = 0
        AND teamID IS NOT NULL
    ) AS teamsPlayedFor,
    (
      SELECT MIN(sch.matchDate)
      FROM scores sc2
      JOIN schedule sch
        ON  sch.seasonID = sc2.seasonID
        AND sch.week     = sc2.week
        AND (sch.team1ID = sc2.teamID OR sch.team2ID = sc2.teamID)
      WHERE sc2.bowlerID = @bowlerID
        AND sc2.isPenalty = 0
        AND sc2.seasonID = (
          SELECT TOP 1 s0.seasonID
          FROM scores s0
          WHERE s0.bowlerID = @bowlerID AND s0.isPenalty = 0
          ORDER BY s0.seasonID ASC
        )
    ) AS firstMatchDate,
    COALESCE(
      (
        SELECT CAST(AVG(g.pins * 1.0) AS DECIMAL(5,1))
        FROM (
          SELECT TOP 27 g2.pins
          FROM (
            SELECT s2.game1 AS pins, sn2.year,
                   CASE sn2.period WHEN 'Fall' THEN 2 ELSE 1 END AS periodOrd,
                   s2.week, 1 AS GameNum
            FROM scores s2
            JOIN seasons sn2 ON s2.seasonID = sn2.seasonID
            WHERE s2.bowlerID = @bowlerID AND s2.isPenalty = 0
              AND s2.game1 > 0 AND s2.game1 IS NOT NULL
            UNION ALL
            SELECT s2.game2, sn2.year,
                   CASE sn2.period WHEN 'Fall' THEN 2 ELSE 1 END,
                   s2.week, 2
            FROM scores s2
            JOIN seasons sn2 ON s2.seasonID = sn2.seasonID
            WHERE s2.bowlerID = @bowlerID AND s2.isPenalty = 0
              AND s2.game2 > 0 AND s2.game2 IS NOT NULL
            UNION ALL
            SELECT s2.game3, sn2.year,
                   CASE sn2.period WHEN 'Fall' THEN 2 ELSE 1 END,
                   s2.week, 3
            FROM scores s2
            JOIN seasons sn2 ON s2.seasonID = sn2.seasonID
            WHERE s2.bowlerID = @bowlerID AND s2.isPenalty = 0
              AND s2.game3 > 0 AND s2.game3 IS NOT NULL
          ) g2
          ORDER BY g2.year DESC, g2.periodOrd DESC, g2.week DESC, g2.GameNum DESC
        ) g
      ),
      (SELECT b2.establishedAvg FROM bowlers b2 WHERE b2.bowlerID = @bowlerID)
    ) AS rollingAvg,
    (
      SELECT TOP 1 s3.incomingAvg
      FROM scores s3
      JOIN seasons sn3 ON s3.seasonID = sn3.seasonID
      WHERE s3.bowlerID = @bowlerID
        AND s3.isPenalty = 0
        AND s3.incomingAvg IS NOT NULL
      ORDER BY sn3.year DESC,
               CASE sn3.period WHEN 'Fall' THEN 2 ELSE 1 END DESC,
               s3.week DESC
    ) AS prevRollingAvg
  FROM vw_BowlerCareerSummary v
  WHERE v.bowlerID = @bowlerID
`;

export const getBowlerCareerSummary = cache(async (bowlerID: number): Promise<BowlerCareerSummary | null> => {
  return cachedQuery(`getBowlerCareerSummary-${bowlerID}`, async () => {
    const db = await getDb();
    const result = await db
      .request()
      .input('bowlerID', bowlerID)
      .query<BowlerCareerSummary>(GET_BOWLER_CAREER_SUMMARY_SQL);
    return result.recordset[0] ?? null;
  }, null, { sql: GET_BOWLER_CAREER_SUMMARY_SQL });
});

export interface BowlerSeasonStats {
  seasonID: number;
  romanNumeral: string;
  displayName: string;
  year: number;
  period: string;
  teamName: string | null;
  teamSlug: string | null;
  seasonSlug: string;
  nightsBowled: number;
  gamesBowled: number;
  totalPins: number;
  seasonAverage: number | null;
  highGame: number | null;
  highSeries: number | null;
  games200Plus: number;
  series600Plus: number;
  turkeys: number;
}

const BOWLER_SEASON_STATS_SQL = `
  SELECT
    sc.seasonID,
    sn.romanNumeral,
    sn.displayName,
    sn.year,
    sn.period,
    COALESCE(tnh.teamName, t.teamName)                   AS teamName,
    t.slug                                               AS teamSlug,
    LOWER(REPLACE(sn.displayName, ' ', '-'))             AS seasonSlug,
    COUNT(sc.scoreID)                                    AS nightsBowled,
    COUNT(sc.scoreID) * 3                                AS gamesBowled,
    SUM(sc.scratchSeries)                                AS totalPins,
    CAST(
      SUM(sc.scratchSeries) * 1.0 /
      NULLIF(COUNT(sc.scoreID) * 3, 0)
    AS DECIMAL(5,1))                                     AS seasonAverage,
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
    SUM(ISNULL(sc.turkeys, 0))                              AS turkeys
  FROM scores sc
  JOIN seasons sn ON sc.seasonID = sn.seasonID
  LEFT JOIN teams t ON sc.teamID = t.teamID
  LEFT JOIN teamNameHistory tnh
    ON  tnh.seasonID = sc.seasonID
    AND tnh.teamID   = sc.teamID
  WHERE sc.bowlerID = @bowlerID
    AND sc.isPenalty = 0
  GROUP BY
    sc.seasonID, sn.romanNumeral, sn.displayName,
    sn.year, sn.period, COALESCE(tnh.teamName, t.teamName), t.slug,
    LOWER(REPLACE(sn.displayName, ' ', '-'))
  ORDER BY
    sn.year DESC,
    CASE sn.period WHEN 'Fall' THEN 1 ELSE 2 END ASC
`;

export async function getBowlerSeasonStats(bowlerID: number): Promise<BowlerSeasonStats[]> {
  return cachedQuery(`getBowlerSeasonStats-${bowlerID}`, async () => {
    const db = await getDb();
    const result = await db
      .request()
      .input('bowlerID', bowlerID)
      .query<BowlerSeasonStats>(BOWLER_SEASON_STATS_SQL);
    return result.recordset;
  }, [], { sql: BOWLER_SEASON_STATS_SQL });
}

export interface GameLogWeek {
  seasonID: number;
  displayName: string;
  seasonSlug: string;
  week: number;
  matchDate: Date | null;
  opponentName: string | null;
  opponentSlug: string | null;
  game1: number | null;
  game2: number | null;
  game3: number | null;
  scratchSeries: number | null;
  turkeys: number;
  incomingAvg: number | null;
}

const GET_BOWLER_GAME_LOG_SQL = `
  SELECT
    sc.seasonID,
    sn.displayName,
    LOWER(REPLACE(sn.displayName, ' ', '-'))             AS seasonSlug,
    sc.week,
    sch.matchDate,
    COALESCE(oppHist.teamName, opp.teamName) AS opponentName,
    opp.slug      AS opponentSlug,
    sc.game1,
    sc.game2,
    sc.game3,
    sc.scratchSeries,
    ISNULL(sc.turkeys, 0) AS turkeys,
    sc.incomingAvg
  FROM scores sc
  JOIN seasons sn ON sc.seasonID = sn.seasonID
  LEFT JOIN schedule sch
    ON  sch.seasonID = sc.seasonID
    AND sch.week     = sc.week
    AND (sch.team1ID = sc.teamID OR sch.team2ID = sc.teamID)
  LEFT JOIN teams opp
    ON  opp.teamID = CASE
          WHEN sch.team1ID = sc.teamID THEN sch.team2ID
          ELSE sch.team1ID
        END
  LEFT JOIN teamNameHistory oppHist
    ON  oppHist.seasonID = sc.seasonID
    AND oppHist.teamID   = CASE
          WHEN sch.team1ID = sc.teamID THEN sch.team2ID
          ELSE sch.team1ID
        END
  WHERE sc.bowlerID = @bowlerID
    AND sc.isPenalty = 0
  ORDER BY
    sn.year DESC,
    CASE sn.period WHEN 'Fall' THEN 2 ELSE 1 END DESC,
    sc.week ASC
`;

export async function getBowlerGameLog(bowlerID: number): Promise<GameLogWeek[]> {
  return cachedQuery(`getBowlerGameLog-${bowlerID}`, async () => {
    const db = await getDb();
    const result = await db
      .request()
      .input('bowlerID', bowlerID)
      .query<GameLogWeek>(GET_BOWLER_GAME_LOG_SQL);
    return result.recordset;
  }, [], { sql: GET_BOWLER_GAME_LOG_SQL });
}

export interface RollingAvgPoint {
  seasonID: number;
  displayName: string;
  week: number;
  rollingAvg: number;
}

const GET_BOWLER_ROLLING_AVG_HISTORY_SQL = `
  SELECT
    sc.seasonID,
    sn.displayName,
    sc.week,
    sc.incomingAvg AS rollingAvg
  FROM scores sc
  JOIN seasons sn ON sc.seasonID = sn.seasonID
  WHERE sc.bowlerID = @bowlerID
    AND sc.isPenalty = 0
    AND sc.incomingAvg IS NOT NULL
  ORDER BY
    sn.year ASC,
    CASE sn.period WHEN 'Fall' THEN 2 ELSE 1 END ASC,
    sc.week ASC
`;

export async function getBowlerRollingAvgHistory(bowlerID: number): Promise<RollingAvgPoint[]> {
  return cachedQuery(`getBowlerRollingAvgHistory-${bowlerID}`, async () => {
    const db = await getDb();
    const result = await db
      .request()
      .input('bowlerID', bowlerID)
      .query<RollingAvgPoint>(GET_BOWLER_ROLLING_AVG_HISTORY_SQL);
    return result.recordset;
  }, [], { sql: GET_BOWLER_ROLLING_AVG_HISTORY_SQL });
}

const GET_CURRENT_SEASON_ID_SQL = `
  SELECT TOP 1 seasonID FROM seasons
  ORDER BY year DESC, CASE period WHEN 'Fall' THEN 2 ELSE 1 END DESC
`;

export const getCurrentSeasonID = cache(async (): Promise<number | null> => {
  return cachedQuery('getCurrentSeasonID', async () => {
    const db = await getDb();
    const result = await db.request().query<{ seasonID: number }>(GET_CURRENT_SEASON_ID_SQL);
    return result.recordset[0]?.seasonID ?? null;
  }, null, { sql: GET_CURRENT_SEASON_ID_SQL });
});

const GET_BOWLER_OF_THE_WEEK_SQL = `
  SELECT TOP 1 sc.bowlerID
  FROM scores sc
  JOIN seasons sn ON sc.seasonID = sn.seasonID
  WHERE sc.isPenalty = 0
    AND sc.seasonID = (
      SELECT TOP 1 seasonID FROM seasons
      ORDER BY year DESC, CASE period WHEN 'Fall' THEN 2 ELSE 1 END DESC
    )
    AND sc.week = (
      SELECT MAX(sc2.week) FROM scores sc2
      WHERE sc2.seasonID = sc.seasonID AND sc2.isPenalty = 0
    )
    AND EXISTS (
      SELECT 1 FROM scores sc3
      WHERE sc3.bowlerID = sc.bowlerID AND sc3.isPenalty = 0
        AND (sc3.seasonID < sc.seasonID OR (sc3.seasonID = sc.seasonID AND sc3.week < sc.week))
    )
  ORDER BY sc.handSeries DESC
`;

export const getBowlerOfTheWeek = cache(async (): Promise<number | null> => {
  return cachedQuery('getBowlerOfTheWeek', async () => {
    const db = await getDb();
    const result = await db.request().query<{ bowlerID: number }>(GET_BOWLER_OF_THE_WEEK_SQL);
    return result.recordset[0]?.bowlerID ?? null;
  }, null, { sql: GET_BOWLER_OF_THE_WEEK_SQL });
});

export interface DirectoryBowler {
  bowlerID: number;
  bowlerName: string;
  slug: string;
  seasonsActive: number;
  isActive: boolean | null;
}

const GET_ALL_BOWLERS_DIRECTORY_SQL = `
  SELECT
    b.bowlerID,
    b.bowlerName,
    b.slug,
    b.isActive,
    COUNT(DISTINCT r.seasonID) AS seasonsActive
  FROM bowlers b
  LEFT JOIN teamRosters r ON r.bowlerID = b.bowlerID
  GROUP BY b.bowlerID, b.bowlerName, b.slug, b.isActive
  ORDER BY b.bowlerName
`;

export const getAllBowlersDirectory = cache(async (): Promise<DirectoryBowler[]> => {
  return cachedQuery('getAllBowlersDirectory', async () => {
    const db = await getDb();
    const result = await db.request().query<DirectoryBowler>(GET_ALL_BOWLERS_DIRECTORY_SQL);
    return result.recordset;
  }, [], { sql: GET_ALL_BOWLERS_DIRECTORY_SQL });
});

/* ───────────────────────────────────────────────────────────
 * "You Are a Star" — aggregate recognition stats
 * ─────────────────────────────────────────────────────────── */

export interface BowlerStarStats {
  botwWins: number;
  playoffAppearances: number;
  championships: number;
  isCaptain: boolean;
  weeklyHighGameWins: number;
  weeklyHighSeriesWins: number;
  aboveAvgAllThreeCount: number;
  threeOfAKindCount: number;
  scratchPlayoffAppearances: number;
  hcpPlayoffAppearances: number;
}

const GET_BOWLER_STAR_STATS_SQL = `
  SELECT p.code, COUNT(*) AS cnt
  FROM bowlerPatches bp
  JOIN patches p ON p.patchID = bp.patchID
  WHERE bp.bowlerID = @bowlerID
  GROUP BY p.code
`;

export interface BowlerPatch {
  seasonID: number;
  week: number | null;
  patch: 'botw' | 'highGame' | 'highSeries' | 'threeOfAKind' | 'playoff' | 'champion' | 'scratchPlayoff' | 'hcpPlayoff' | 'scratchChampion' | 'hcpChampion';
}

const GET_BOWLER_PATCHES_SQL = `
  SELECT bp.seasonID, bp.week, p.code AS patch
  FROM bowlerPatches bp
  JOIN patches p ON p.patchID = bp.patchID
  WHERE bp.bowlerID = @bowlerID
  ORDER BY bp.seasonID, bp.week
`;

export async function getBowlerPatches(bowlerID: number): Promise<BowlerPatch[]> {
  return cachedQuery(`getBowlerPatches-${bowlerID}`, async () => {
    const db = await getDb();
    const result = await db
      .request()
      .input('bowlerID', bowlerID)
      .query<BowlerPatch>(GET_BOWLER_PATCHES_SQL);
    return result.recordset;
  }, [], { sql: GET_BOWLER_PATCHES_SQL });
}

export async function getBowlerStarStats(bowlerID: number): Promise<BowlerStarStats> {
  const empty: BowlerStarStats = {
    botwWins: 0,
    playoffAppearances: 0,
    championships: 0,
    isCaptain: false,
    weeklyHighGameWins: 0,
    weeklyHighSeriesWins: 0,
    aboveAvgAllThreeCount: 0,
    threeOfAKindCount: 0,
    scratchPlayoffAppearances: 0,
    hcpPlayoffAppearances: 0,
  };
  return cachedQuery(`getBowlerStarStats-${bowlerID}`, async () => {
    const db = await getDb();
    const result = await db
      .request()
      .input('bowlerID', bowlerID)
      .query<{ code: string; cnt: number }>(GET_BOWLER_STAR_STATS_SQL);

    const counts = new Map(result.recordset.map(r => [r.code, r.cnt]));
    return {
      botwWins: counts.get('botw') ?? 0,
      playoffAppearances: counts.get('playoff') ?? 0,
      championships: counts.get('champion') ?? 0,
      isCaptain: (counts.get('captain') ?? 0) > 0,
      weeklyHighGameWins: counts.get('highGame') ?? 0,
      weeklyHighSeriesWins: counts.get('highSeries') ?? 0,
      aboveAvgAllThreeCount: counts.get('aboveAvg') ?? 0,
      threeOfAKindCount: counts.get('threeOfAKind') ?? 0,
      scratchPlayoffAppearances: counts.get('scratchPlayoff') ?? 0,
      hcpPlayoffAppearances: counts.get('hcpPlayoff') ?? 0,
    };
  }, empty, { sql: GET_BOWLER_STAR_STATS_SQL });
}
