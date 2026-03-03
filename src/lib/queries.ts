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
          ) AS firstMatchDate
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
 * Ordered chronologically (oldest to newest) -- table is NOT sortable per design decision.
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
          t.teamName,
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
        WHERE sc.bowlerID = @bowlerID
          AND sc.isPenalty = 0
        GROUP BY
          sc.seasonID, sn.romanNumeral, sn.displayName,
          sn.year, sn.period, t.teamName, t.slug
        ORDER BY
          sn.year ASC,
          CASE sn.period WHEN 'Spring' THEN 1 ELSE 2 END ASC
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
          opp.teamName  AS opponentName,
          opp.slug      AS opponentSlug,
          sc.game1,
          sc.game2,
          sc.game3,
          sc.scratchSeries
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
