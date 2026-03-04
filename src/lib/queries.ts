/**
 * Named SQL query functions for build-time data fetching.
 *
 * All SQL lives here — page components call these functions, never raw SQL.
 * These functions are server-only (imported via db.ts).
 *
 * Phase 1: Minimal queries for static page generation.
 * Phase 2: Expand getBowlerBySlug with full stats, career history, records.
 */
import { cache } from 'react';
import { getDb } from './db';

export interface BowlerSlug {
  slug: string;
}

export interface Bowler {
  bowlerID: number;
  bowlerName: string;
  slug: string;
  isActive: boolean | null;
}

/**
 * Returns all bowler slugs for generateStaticParams.
 * Includes ALL bowlers (active and inactive) so historical profiles work.
 * Uses the slug column directly from the bowlers table.
 * Returns empty array if DB credentials are not configured (e.g., local dev without .env.local).
 */
export async function getAllBowlerSlugs(): Promise<BowlerSlug[]> {
  if (!process.env.AZURE_SQL_SERVER) {
    return [];
  }
  try {
    const db = await getDb();
    const result = await db.request().query<{ slug: string }>(`
      SELECT slug
      FROM bowlers
      ORDER BY bowlerName
    `);
    return result.recordset;
  } catch (err) {
    console.warn('getAllBowlerSlugs: DB unavailable, returning empty list.', err);
    return [];
  }
}

/**
 * Returns a single bowler record by slug.
 * Uses the slug column directly from the bowlers table.
 *
 * Phase 1: Returns minimal fields for scaffold page.
 * Phase 2: Expand with career stats, season history, personal records.
 * Returns null if DB credentials are not configured.
 */
export async function getBowlerBySlug(slug: string): Promise<Bowler | null> {
  if (!process.env.AZURE_SQL_SERVER) {
    return null;
  }
  try {
    const db = await getDb();
    const result = await db
      .request()
      .input('slug', slug)
      .query<Bowler>(`
        SELECT
          bowlerID,
          bowlerName,
          slug,
          isActive
        FROM bowlers
        WHERE slug = @slug
      `);
    return result.recordset[0] ?? null;
  } catch (err) {
    console.warn('getBowlerBySlug: DB unavailable, returning null.', err);
    return null;
  }
}

/* ───────────────────────────────────────────────────────────
 * Phase 2: Bowler Profile Queries
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

/**
 * Career summary for the bowler hero header and personal records panel.
 * Fetches from vw_BowlerCareerSummary plus a distinct-team count subquery.
 * Wrapped in React.cache to deduplicate calls between generateMetadata and page component.
 * Returns null if DB unavailable.
 */
export const getBowlerCareerSummary = cache(async (bowlerID: number): Promise<BowlerCareerSummary | null> => {
  if (!process.env.AZURE_SQL_SERVER) return null;
  try {
    const db = await getDb();
    const result = await db
      .request()
      .input('bowlerID', bowlerID)
      .query<BowlerCareerSummary>(`
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
      `);
    return result.recordset[0] ?? null;
  } catch (err) {
    console.warn('getBowlerCareerSummary: DB unavailable', err);
    return null;
  }
});

export interface BowlerSeasonStats {
  seasonID: number;
  romanNumeral: string;
  displayName: string;
  year: number;
  period: string;
  teamName: string | null;
  teamSlug: string | null;
  nightsBowled: number;
  gamesBowled: number;
  totalPins: number;
  seasonAverage: number | null;
  highGame: number | null;
  highSeries: number | null;
  games200Plus: number;
  series600Plus: number;
}

/**
 * Season-by-season stats for the stats table.
 * Queries scores directly (not the view) to get teamSlug for /team/[slug] cross-links.
 * Ordered reverse chronologically (newest to oldest) -- table is NOT sortable per design decision.
 * Returns [] if DB unavailable or no data.
 */
export async function getBowlerSeasonStats(bowlerID: number): Promise<BowlerSeasonStats[]> {
  if (!process.env.AZURE_SQL_SERVER) return [];
  try {
    const db = await getDb();
    const result = await db
      .request()
      .input('bowlerID', bowlerID)
      .query<BowlerSeasonStats>(`
        SELECT
          sc.seasonID,
          sn.romanNumeral,
          sn.displayName,
          sn.year,
          sn.period,
          COALESCE(tnh.teamName, t.teamName)                   AS teamName,
          t.slug                                               AS teamSlug,
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
          SUM(CASE WHEN sc.scratchSeries >= 600 THEN 1 ELSE 0 END) AS series600Plus
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
          sn.year, sn.period, COALESCE(tnh.teamName, t.teamName), t.slug
        ORDER BY
          sn.year DESC,
          CASE sn.period WHEN 'Fall' THEN 1 ELSE 2 END ASC
      `);
    return result.recordset;
  } catch (err) {
    console.warn('getBowlerSeasonStats: DB unavailable', err);
    return [];
  }
}

export interface GameLogWeek {
  seasonID: number;
  displayName: string;
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

/**
 * Game-by-game log for the accordion section.
 * Ordered newest season first, ascending week within season.
 * Opponent is NULL for pre-Season XXVI rows -- the UI must render a dash for nulls.
 * Returns [] if DB unavailable or no data.
 */
export async function getBowlerGameLog(bowlerID: number): Promise<GameLogWeek[]> {
  if (!process.env.AZURE_SQL_SERVER) return [];
  try {
    const db = await getDb();
    const result = await db
      .request()
      .input('bowlerID', bowlerID)
      .query<GameLogWeek>(`
        SELECT
          sc.seasonID,
          sn.displayName,
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
      `);
    return result.recordset;
  } catch (err) {
    console.warn('getBowlerGameLog: DB unavailable', err);
    return [];
  }
}

export interface RollingAvgPoint {
  seasonID: number;
  displayName: string;
  week: number;
  rollingAvg: number;
}

/**
 * Returns the per-week rolling average history for the progression chart.
 * Reads directly from scores.incomingAvg (backfilled), no computation needed.
 * Ordered chronologically (oldest to newest).
 * Returns [] if DB unavailable or no data.
 */
export async function getBowlerRollingAvgHistory(bowlerID: number): Promise<RollingAvgPoint[]> {
  if (!process.env.AZURE_SQL_SERVER) return [];
  try {
    const db = await getDb();
    const result = await db
      .request()
      .input('bowlerID', bowlerID)
      .query<RollingAvgPoint>(`
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
      `);
    return result.recordset;
  } catch (err) {
    console.warn('getBowlerRollingAvgHistory: DB unavailable', err);
    return [];
  }
}

/**
 * Returns the seasonID of the current (most recent) season.
 * Cached across all bowler page builds.
 */
export const getCurrentSeasonID = cache(async (): Promise<number | null> => {
  if (!process.env.AZURE_SQL_SERVER) return null;
  try {
    const db = await getDb();
    const result = await db.request().query<{ seasonID: number }>(`
      SELECT TOP 1 seasonID FROM seasons
      ORDER BY year DESC, CASE period WHEN 'Fall' THEN 2 ELSE 1 END DESC
    `);
    return result.recordset[0]?.seasonID ?? null;
  } catch (err) {
    console.warn('getCurrentSeasonID: DB unavailable', err);
    return null;
  }
});

/**
 * Returns the bowlerID of the Bowler of the Week — the bowler with the highest
 * handicap series (handSeries) in the most recent week of the most recent season.
 * Cached to deduplicate across all 625 bowler page builds.
 */
export const getBowlerOfTheWeek = cache(async (): Promise<number | null> => {
  if (!process.env.AZURE_SQL_SERVER) return null;
  try {
    const db = await getDb();
    const result = await db.request().query<{ bowlerID: number }>(`
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
      ORDER BY sc.handSeries DESC
    `);
    return result.recordset[0]?.bowlerID ?? null;
  } catch (err) {
    console.warn('getBowlerOfTheWeek: DB unavailable', err);
    return null;
  }
});

/* ───────────────────────────────────────────────────────────
 * Phase 3: Home Page and Directory Queries
 * ─────────────────────────────────────────────────────────── */

/**
 * Returns the next scheduled bowling night as an ISO date string.
 * Used by the countdown clock on the home page.
 * Returns null if no future dates exist or DB is unavailable.
 */
export async function getNextBowlingNight(): Promise<string | null> {
  if (!process.env.AZURE_SQL_SERVER) return null;
  try {
    const db = await getDb();
    const result = await db.request().query<{ matchDate: Date }>(`
      SELECT TOP 1 matchDate
      FROM schedule
      WHERE matchDate >= CAST(GETDATE() AS DATE)
      ORDER BY matchDate ASC
    `);
    return result.recordset[0]?.matchDate?.toISOString() ?? null;
  } catch (err) {
    console.warn('getNextBowlingNight: DB unavailable', err);
    return null;
  }
}

export interface DirectoryBowler {
  bowlerID: number;
  bowlerName: string;
  slug: string;
  seasonsActive: number;
  isActive: boolean | null;
}

/**
 * Returns all bowlers with season counts for the /bowlers directory page.
 * Wrapped in React.cache (used by both generateMetadata and page component).
 * Returns [] if DB unavailable.
 */
export const getAllBowlersDirectory = cache(async (): Promise<DirectoryBowler[]> => {
  if (!process.env.AZURE_SQL_SERVER) return [];
  try {
    const db = await getDb();
    const result = await db.request().query<DirectoryBowler>(`
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
    `);
    return result.recordset;
  } catch (err) {
    console.warn('getAllBowlersDirectory: DB unavailable', err);
    return [];
  }
});

export interface Milestone {
  bowlerID: number;
  bowlerName: string;
  slug: string;
  type: 'achieved' | 'approaching';
  milestone: string;
  current: number;
  threshold: number;
}

/**
 * Returns recently achieved and approaching career game milestones.
 * Used by the milestone ticker on the home page.
 * Wrapped in React.cache (used by both generateMetadata and page component).
 * Returns [] if DB unavailable.
 */
export const getRecentMilestones = cache(async (): Promise<Milestone[]> => {
  if (!process.env.AZURE_SQL_SERVER) return [];
  try {
    const db = await getDb();
    const result = await db.request().query<Milestone>(`
      WITH CareerGames AS (
        SELECT
          sc.bowlerID,
          b.bowlerName,
          b.slug,
          COUNT(sc.scoreID) * 3 AS totalGames
        FROM scores sc
        JOIN bowlers b ON sc.bowlerID = b.bowlerID
        WHERE sc.isPenalty = 0
        GROUP BY sc.bowlerID, b.bowlerName, b.slug
      )
      SELECT TOP 10 bowlerID, bowlerName, slug, type, milestone, current, threshold
      FROM (
        SELECT bowlerID, bowlerName, slug,
          'achieved' AS type,
          CAST(threshold AS VARCHAR) + ' career games' AS milestone,
          totalGames AS current,
          threshold
        FROM CareerGames
        CROSS JOIN (VALUES (50),(100),(150),(200),(250),(300),(400),(500)) AS T(threshold)
        WHERE totalGames BETWEEN threshold AND threshold + 9
        UNION ALL
        SELECT bowlerID, bowlerName, slug,
          'approaching' AS type,
          CAST(threshold AS VARCHAR) + ' career games' AS milestone,
          totalGames AS current,
          threshold
        FROM CareerGames
        CROSS JOIN (VALUES (50),(100),(150),(200),(250),(300),(400),(500)) AS T(threshold)
        WHERE totalGames BETWEEN threshold - 5 AND threshold - 1
      ) combined
      ORDER BY type, threshold DESC
    `);
    return result.recordset;
  } catch (err) {
    console.warn('getRecentMilestones: DB unavailable', err);
    return [];
  }
});

export interface SeasonSnapshot {
  seasonID: number;
  displayName: string;
  romanNumeral: string;
  weekNumber: number;
  totalGames: number;
  totalBowlers: number;
  leagueAverage: number;
  topMaleAvg: { bowlerName: string; slug: string; average: number } | null;
  topFemaleAvg: { bowlerName: string; slug: string; average: number } | null;
  topHcpAvg: { bowlerName: string; slug: string; average: number } | null;
  highGame: { bowlerName: string; slug: string; score: number } | null;
  highSeries: { bowlerName: string; slug: string; score: number } | null;
  bowlerOfTheWeek: { bowlerName: string; slug: string; score: number } | null;
  teamOfTheWeek: { teamName: string; teamSlug: string; score: number } | null;
}

/**
 * Returns a snapshot of the current (most recent) season for the home page.
 * Includes top average, high game, high series, and aggregate stats.
 * Wrapped in React.cache (used by both generateMetadata and page component).
 * Returns null if DB unavailable.
 */
export const getCurrentSeasonSnapshot = cache(async (): Promise<SeasonSnapshot | null> => {
  if (!process.env.AZURE_SQL_SERVER) return null;
  try {
    const db = await getDb();

    // Step 1: Find the most recent season
    const seasonResult = await db.request().query<{
      seasonID: number;
      displayName: string;
      romanNumeral: string;
    }>(`
      SELECT TOP 1 seasonID, displayName, romanNumeral
      FROM seasons
      ORDER BY year DESC, CASE period WHEN 'Fall' THEN 2 ELSE 1 END DESC
    `);

    const season = seasonResult.recordset[0];
    if (!season) return null;

    // Step 2: Get aggregate stats for this season
    const statsResult = await db.request()
      .input('seasonID', season.seasonID)
      .query<{
        weekNumber: number;
        totalGames: number;
        totalBowlers: number;
        leagueAverage: number;
      }>(`
        SELECT
          MAX(sc.week) AS weekNumber,
          COUNT(sc.scoreID) * 3 AS totalGames,
          COUNT(DISTINCT sc.bowlerID) AS totalBowlers,
          CAST(SUM(sc.scratchSeries) * 1.0 / NULLIF(COUNT(sc.scoreID) * 3, 0) AS DECIMAL(5,1)) AS leagueAverage
        FROM scores sc
        WHERE sc.seasonID = @seasonID
          AND sc.isPenalty = 0
      `);

    const stats = statsResult.recordset[0];

    // Step 3: Top averages by gender + handicap (minimum 3 nights bowled)
    const topMaleAvgResult = await db.request()
      .input('seasonID', season.seasonID)
      .query<{ bowlerName: string; slug: string; average: number }>(`
        SELECT TOP 1
          b.bowlerName, b.slug,
          CAST(SUM(sc.scratchSeries) * 1.0 / NULLIF(COUNT(sc.scoreID) * 3, 0) AS DECIMAL(5,1)) AS average
        FROM scores sc
        JOIN bowlers b ON sc.bowlerID = b.bowlerID
        WHERE sc.seasonID = @seasonID AND sc.isPenalty = 0 AND b.gender = 'M'
        GROUP BY sc.bowlerID, b.bowlerName, b.slug
        HAVING COUNT(sc.scoreID) >= 3
        ORDER BY average DESC
      `);

    const topFemaleAvgResult = await db.request()
      .input('seasonID', season.seasonID)
      .query<{ bowlerName: string; slug: string; average: number }>(`
        SELECT TOP 1
          b.bowlerName, b.slug,
          CAST(SUM(sc.scratchSeries) * 1.0 / NULLIF(COUNT(sc.scoreID) * 3, 0) AS DECIMAL(5,1)) AS average
        FROM scores sc
        JOIN bowlers b ON sc.bowlerID = b.bowlerID
        WHERE sc.seasonID = @seasonID AND sc.isPenalty = 0 AND b.gender = 'F'
        GROUP BY sc.bowlerID, b.bowlerName, b.slug
        HAVING COUNT(sc.scoreID) >= 3
        ORDER BY average DESC
      `);

    const topHcpAvgResult = await db.request()
      .input('seasonID', season.seasonID)
      .query<{ bowlerName: string; slug: string; average: number }>(`
        SELECT TOP 1
          b.bowlerName, b.slug,
          CAST(SUM(sc.handSeries) * 1.0 / NULLIF(COUNT(sc.scoreID) * 3, 0) AS DECIMAL(5,1)) AS average
        FROM scores sc
        JOIN bowlers b ON sc.bowlerID = b.bowlerID
        WHERE sc.seasonID = @seasonID AND sc.isPenalty = 0
        GROUP BY sc.bowlerID, b.bowlerName, b.slug
        HAVING COUNT(sc.scoreID) >= 3
        ORDER BY average DESC
      `);

    // Step 4: High game
    const highGameResult = await db.request()
      .input('seasonID', season.seasonID)
      .query<{ bowlerName: string; slug: string; score: number }>(`
        SELECT TOP 1
          b.bowlerName,
          b.slug,
          g.score
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
      `);

    // Step 5: High series
    const highSeriesResult = await db.request()
      .input('seasonID', season.seasonID)
      .query<{ bowlerName: string; slug: string; score: number }>(`
        SELECT TOP 1
          b.bowlerName,
          b.slug,
          sc.scratchSeries AS score
        FROM scores sc
        JOIN bowlers b ON sc.bowlerID = b.bowlerID
        WHERE sc.seasonID = @seasonID
          AND sc.isPenalty = 0
        ORDER BY sc.scratchSeries DESC
      `);

    // Step 6: Bowler of the Week (highest handicap series in latest week)
    const botwResult = await db.request()
      .input('seasonID', season.seasonID)
      .query<{ bowlerName: string; slug: string; score: number }>(`
        SELECT TOP 1
          b.bowlerName,
          b.slug,
          sc.handSeries AS score
        FROM scores sc
        JOIN bowlers b ON sc.bowlerID = b.bowlerID
        WHERE sc.seasonID = @seasonID
          AND sc.isPenalty = 0
          AND sc.week = (
            SELECT MAX(sc2.week) FROM scores sc2
            WHERE sc2.seasonID = @seasonID AND sc2.isPenalty = 0
          )
        ORDER BY sc.handSeries DESC
      `);

    // Step 7: Team of the Week (highest total handicap series in latest week)
    const totwResult = await db.request()
      .input('seasonID', season.seasonID)
      .query<{ teamName: string; teamSlug: string; totalHandSeries: number }>(`
        SELECT TOP 1
          t.teamName,
          t.slug AS teamSlug,
          SUM(sc.handSeries) AS totalHandSeries
        FROM scores sc
        JOIN teams t ON sc.teamID = t.teamID
        WHERE sc.seasonID = @seasonID
          AND sc.isPenalty = 0
          AND sc.teamID IS NOT NULL
          AND sc.week = (
            SELECT MAX(sc2.week) FROM scores sc2
            WHERE sc2.seasonID = @seasonID AND sc2.isPenalty = 0
          )
        GROUP BY sc.teamID, t.teamName, t.slug
        ORDER BY totalHandSeries DESC
      `);
    const totwRow = totwResult.recordset[0];
    const teamOfTheWeek: SeasonSnapshot['teamOfTheWeek'] = totwRow
      ? { teamName: totwRow.teamName, teamSlug: totwRow.teamSlug, score: totwRow.totalHandSeries }
      : null;

    return {
      seasonID: season.seasonID,
      displayName: season.displayName,
      romanNumeral: season.romanNumeral,
      weekNumber: stats?.weekNumber ?? 0,
      totalGames: stats?.totalGames ?? 0,
      totalBowlers: stats?.totalBowlers ?? 0,
      leagueAverage: stats?.leagueAverage ?? 0,
      topMaleAvg: topMaleAvgResult.recordset[0] ?? null,
      topFemaleAvg: topFemaleAvgResult.recordset[0] ?? null,
      topHcpAvg: topHcpAvgResult.recordset[0] ?? null,
      highGame: highGameResult.recordset[0] ?? null,
      highSeries: highSeriesResult.recordset[0] ?? null,
      bowlerOfTheWeek: botwResult.recordset[0] ?? null,
      teamOfTheWeek,
    };
  } catch (err) {
    console.warn('getCurrentSeasonSnapshot: DB unavailable', err);
    return null;
  }
});

/* ───────────────────────────────────────────────────────────
 * Phase 4: Team Queries
 * ─────────────────────────────────────────────────────────── */

export interface TeamSlug {
  slug: string;
}

export interface Team {
  teamID: number;
  teamName: string;
  slug: string;
}

export interface TeamRosterMember {
  bowlerID: number;
  bowlerName: string;
  slug: string;
  gamesBowled: number;
  seasonAverage: number | null;
}

export interface TeamSeasonRow {
  seasonID: number;
  seasonName: string;
  seasonSlug: string;
  romanNumeral: string;
  teamNameAtTime: string;
  totalGames: number;
  totalPins: number;
  teamAverage: number | null;
  rosterSize: number;
  hasScheduleData: boolean;
}

export interface TeamSeasonBowler {
  bowlerID: number;
  bowlerName: string;
  slug: string;
  gamesBowled: number;
  totalPins: number;
  average: number | null;
}

export interface AllTimeRosterMember {
  bowlerID: number;
  bowlerName: string;
  slug: string;
  totalGames: number;
  totalPins: number;
  average: number | null;
  seasonsWithTeam: number;
}

export interface FranchiseNameEntry {
  id: number;
  seasonID: number;
  teamName: string;
}

export interface DirectoryTeam {
  teamID: number;
  teamName: string;
  slug: string;
  rosterCount: number;
  seasonsActive: number;
  totalGames: number;
  totalPins: number;
  isActive: boolean;
}

/**
 * Returns all team slugs for generateStaticParams.
 * Returns empty array if DB credentials are not configured.
 */
export async function getAllTeamSlugs(): Promise<TeamSlug[]> {
  if (!process.env.AZURE_SQL_SERVER) return [];
  try {
    const db = await getDb();
    const result = await db.request().query<TeamSlug>(`
      SELECT slug FROM teams WHERE slug IS NOT NULL ORDER BY teamName
    `);
    return result.recordset;
  } catch (err) {
    console.warn('getAllTeamSlugs: DB unavailable', err);
    return [];
  }
}

/**
 * Returns a single team record by slug.
 * Wrapped in React.cache (used by both generateMetadata and page component).
 * Returns null if DB unavailable.
 */
export const getTeamBySlug = cache(async (slug: string): Promise<Team | null> => {
  if (!process.env.AZURE_SQL_SERVER) return null;
  try {
    const db = await getDb();
    const result = await db
      .request()
      .input('slug', slug)
      .query<Team>(`
        SELECT teamID, teamName, slug
        FROM teams
        WHERE slug = @slug
      `);
    return result.recordset[0] ?? null;
  } catch (err) {
    console.warn('getTeamBySlug: DB unavailable', err);
    return null;
  }
});

/**
 * Returns the current roster for a team (bowlers who bowled in the current season).
 * Each member includes games bowled and season average.
 * Sorted by games bowled DESC.
 * Returns [] if DB unavailable.
 */
export async function getTeamCurrentRoster(teamID: number): Promise<TeamRosterMember[]> {
  if (!process.env.AZURE_SQL_SERVER) return [];
  try {
    const db = await getDb();
    const result = await db
      .request()
      .input('teamID', teamID)
      .query<TeamRosterMember>(`
        SELECT
          b.bowlerID,
          b.bowlerName,
          b.slug,
          COUNT(sc.scoreID) * 3 AS gamesBowled,
          CAST(
            SUM(sc.scratchSeries) * 1.0 /
            NULLIF(COUNT(sc.scoreID) * 3, 0)
          AS DECIMAL(5,1)) AS seasonAverage
        FROM scores sc
        JOIN bowlers b ON sc.bowlerID = b.bowlerID
        WHERE sc.teamID = @teamID
          AND sc.isPenalty = 0
          AND sc.seasonID = (
            SELECT TOP 1 seasonID FROM seasons
            ORDER BY year DESC, CASE period WHEN 'Fall' THEN 2 ELSE 1 END DESC
          )
        GROUP BY b.bowlerID, b.bowlerName, b.slug
        ORDER BY gamesBowled DESC, seasonAverage DESC
      `);
    return result.recordset;
  } catch (err) {
    console.warn('getTeamCurrentRoster: DB unavailable', err);
    return [];
  }
}

/**
 * Returns season-by-season stats for a team.
 * One row per season the team participated in, ordered newest first.
 * Includes team name at time from teamNameHistory, falling back to current name.
 * Returns [] if DB unavailable.
 */
export async function getTeamSeasonByseason(teamID: number): Promise<TeamSeasonRow[]> {
  if (!process.env.AZURE_SQL_SERVER) return [];
  try {
    const db = await getDb();
    const result = await db
      .request()
      .input('teamID', teamID)
      .query<TeamSeasonRow>(`
        SELECT
          sc.seasonID,
          sn.displayName                                     AS seasonName,
          LOWER(REPLACE(sn.displayName, ' ', '-'))           AS seasonSlug,
          sn.romanNumeral,
          COALESCE(tnh.teamName, t.teamName)                 AS teamNameAtTime,
          COUNT(sc.scoreID) * 3                              AS totalGames,
          SUM(sc.scratchSeries)                              AS totalPins,
          CAST(
            SUM(sc.scratchSeries) * 1.0 /
            NULLIF(COUNT(sc.scoreID) * 3, 0)
          AS DECIMAL(5,1))                                   AS teamAverage,
          COUNT(DISTINCT sc.bowlerID)                        AS rosterSize,
          CAST(CASE WHEN EXISTS (
            SELECT 1 FROM schedule sch WHERE sch.seasonID = sc.seasonID
          ) THEN 1 ELSE 0 END AS BIT)                       AS hasScheduleData
        FROM scores sc
        JOIN seasons sn ON sc.seasonID = sn.seasonID
        JOIN teams t ON t.teamID = @teamID
        LEFT JOIN teamNameHistory tnh
          ON  tnh.seasonID = sc.seasonID
          AND tnh.teamID   = @teamID
        WHERE sc.teamID = @teamID
          AND sc.isPenalty = 0
        GROUP BY
          sc.seasonID, sn.displayName, sn.romanNumeral,
          sn.year, sn.period,
          COALESCE(tnh.teamName, t.teamName)
        ORDER BY
          sn.year DESC,
          CASE sn.period WHEN 'Fall' THEN 1 ELSE 2 END ASC
      `);
    return result.recordset;
  } catch (err) {
    console.warn('getTeamSeasonByseason: DB unavailable', err);
    return [];
  }
}

/**
 * Returns individual bowler stats for a specific team+season combination.
 * Used when expanding a season row in the team page.
 * Sorted by games bowled DESC.
 * Returns [] if DB unavailable.
 */
export async function getTeamSeasonBowlers(teamID: number, seasonID: number): Promise<TeamSeasonBowler[]> {
  if (!process.env.AZURE_SQL_SERVER) return [];
  try {
    const db = await getDb();
    const result = await db
      .request()
      .input('teamID', teamID)
      .input('seasonID', seasonID)
      .query<TeamSeasonBowler>(`
        SELECT
          b.bowlerID,
          b.bowlerName,
          b.slug,
          COUNT(sc.scoreID) * 3 AS gamesBowled,
          SUM(sc.scratchSeries) AS totalPins,
          CAST(
            SUM(sc.scratchSeries) * 1.0 /
            NULLIF(COUNT(sc.scoreID) * 3, 0)
          AS DECIMAL(5,1)) AS average
        FROM scores sc
        JOIN bowlers b ON sc.bowlerID = b.bowlerID
        WHERE sc.teamID = @teamID
          AND sc.seasonID = @seasonID
          AND sc.isPenalty = 0
        GROUP BY b.bowlerID, b.bowlerName, b.slug
        ORDER BY gamesBowled DESC, average DESC
      `);
    return result.recordset;
  } catch (err) {
    console.warn('getTeamSeasonBowlers: DB unavailable', err);
    return [];
  }
}

/**
 * Returns the all-time roster for a team — every bowler who ever bowled for this team.
 * Sorted by total games DESC (loyalty metric).
 * Returns [] if DB unavailable.
 */
export async function getTeamAllTimeRoster(teamID: number): Promise<AllTimeRosterMember[]> {
  if (!process.env.AZURE_SQL_SERVER) return [];
  try {
    const db = await getDb();
    const result = await db
      .request()
      .input('teamID', teamID)
      .query<AllTimeRosterMember>(`
        SELECT
          b.bowlerID,
          b.bowlerName,
          b.slug,
          COUNT(sc.scoreID) * 3 AS totalGames,
          SUM(sc.scratchSeries) AS totalPins,
          CAST(
            SUM(sc.scratchSeries) * 1.0 /
            NULLIF(COUNT(sc.scoreID) * 3, 0)
          AS DECIMAL(5,1)) AS average,
          COUNT(DISTINCT sc.seasonID) AS seasonsWithTeam
        FROM scores sc
        JOIN bowlers b ON sc.bowlerID = b.bowlerID
        WHERE sc.teamID = @teamID
          AND sc.isPenalty = 0
        GROUP BY b.bowlerID, b.bowlerName, b.slug
        ORDER BY totalGames DESC, average DESC
      `);
    return result.recordset;
  } catch (err) {
    console.warn('getTeamAllTimeRoster: DB unavailable', err);
    return [];
  }
}

/**
 * Returns the franchise name history for a team.
 * Shows all names this team has used across seasons, ordered chronologically.
 * Returns [] if DB unavailable.
 */
export async function getTeamFranchiseHistory(teamID: number): Promise<FranchiseNameEntry[]> {
  if (!process.env.AZURE_SQL_SERVER) return [];
  try {
    const db = await getDb();
    const result = await db
      .request()
      .input('teamID', teamID)
      .query<FranchiseNameEntry>(`
        SELECT
          tnh.id,
          tnh.seasonID,
          tnh.teamName
        FROM teamNameHistory tnh
        JOIN seasons sn ON tnh.seasonID = sn.seasonID
        WHERE tnh.teamID = @teamID
        ORDER BY sn.year ASC, CASE sn.period WHEN 'Fall' THEN 2 ELSE 1 END ASC
      `);
    return result.recordset;
  } catch (err) {
    console.warn('getTeamFranchiseHistory: DB unavailable', err);
    return [];
  }
}

/**
 * Returns all teams with aggregate stats for the /teams directory.
 * Active teams (with scores in current season) listed first, then by name.
 * Wrapped in React.cache (used by both generateMetadata and page component).
 * Returns [] if DB unavailable.
 */
export const getAllTeamsDirectory = cache(async (): Promise<DirectoryTeam[]> => {
  if (!process.env.AZURE_SQL_SERVER) return [];
  try {
    const db = await getDb();
    const result = await db.request().query<DirectoryTeam>(`
      SELECT
        t.teamID,
        t.teamName,
        t.slug,
        COUNT(DISTINCT sc.bowlerID)  AS rosterCount,
        COUNT(DISTINCT sc.seasonID)  AS seasonsActive,
        COUNT(sc.scoreID) * 3        AS totalGames,
        SUM(sc.scratchSeries)        AS totalPins,
        CAST(CASE WHEN EXISTS (
          SELECT 1 FROM scores sc2
          WHERE sc2.teamID = t.teamID
            AND sc2.isPenalty = 0
            AND sc2.seasonID = (
              SELECT TOP 1 seasonID FROM seasons
              ORDER BY year DESC, CASE period WHEN 'Fall' THEN 2 ELSE 1 END DESC
            )
        ) THEN 1 ELSE 0 END AS BIT) AS isActive
      FROM teams t
      LEFT JOIN scores sc ON sc.teamID = t.teamID AND sc.isPenalty = 0
      GROUP BY t.teamID, t.teamName, t.slug
      ORDER BY
        CASE WHEN EXISTS (
          SELECT 1 FROM scores sc2
          WHERE sc2.teamID = t.teamID
            AND sc2.isPenalty = 0
            AND sc2.seasonID = (
              SELECT TOP 1 seasonID FROM seasons
              ORDER BY year DESC, CASE period WHEN 'Fall' THEN 2 ELSE 1 END DESC
            )
        ) THEN 0 ELSE 1 END,
        t.teamName ASC
    `);
    return result.recordset;
  } catch (err) {
    console.warn('getAllTeamsDirectory: DB unavailable', err);
    return [];
  }
});
