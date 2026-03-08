/**
 * Home page queries: countdown, milestones, season snapshot.
 */
import { cache } from 'react';
import { getDb, cachedQuery } from '../db';

export async function getNextBowlingNight(): Promise<string | null> {
  return cachedQuery('getNextBowlingNight', async () => {
    const db = await getDb();
    const result = await db.request().query<{ matchDate: Date }>(`
      SELECT TOP 1 matchDate
      FROM schedule
      WHERE matchDate >= CAST(GETDATE() AS DATE)
      ORDER BY matchDate ASC
    `);
    return result.recordset[0]?.matchDate?.toISOString() ?? null;
  }, null);
}

export interface Milestone {
  bowlerID: number;
  bowlerName: string;
  slug: string;
  type: 'achieved' | 'approaching';
  milestone: string;
  current: number;
  threshold: number;
}

export const getRecentMilestones = cache(async (): Promise<Milestone[]> => {
  return cachedQuery('getRecentMilestones', async () => {
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
      SELECT TOP 10 bowlerID, bowlerName, slug, type, milestone, [current], threshold
      FROM (
        SELECT bowlerID, bowlerName, slug,
          'achieved' AS type,
          CAST(threshold AS VARCHAR) + ' career games' AS milestone,
          totalGames AS [current],
          threshold
        FROM CareerGames
        CROSS JOIN (VALUES (50),(100),(150),(200),(250),(300),(400),(500)) AS T(threshold)
        WHERE totalGames BETWEEN threshold AND threshold + 9
        UNION ALL
        SELECT bowlerID, bowlerName, slug,
          'approaching' AS type,
          CAST(threshold AS VARCHAR) + ' career games' AS milestone,
          totalGames AS [current],
          threshold
        FROM CareerGames
        CROSS JOIN (VALUES (50),(100),(150),(200),(250),(300),(400),(500)) AS T(threshold)
        WHERE totalGames BETWEEN threshold - 5 AND threshold - 1
      ) combined
      ORDER BY type, threshold DESC
    `);
    return result.recordset;
  }, []);
});

export interface SeasonSnapshot {
  seasonID: number;
  displayName: string;
  romanNumeral: string;
  slug: string;
  weekNumber: number;
  totalBowlers: number;
  leagueAverage: number;
  expectedLeagueAverage: number;
  topMaleAvg: { bowlerName: string; slug: string; average: number } | null;
  topFemaleAvg: { bowlerName: string; slug: string; average: number } | null;
  topHcpAvg: { bowlerName: string; slug: string; average: number } | null;
  highGame: { bowlerName: string; slug: string; score: number } | null;
  highSeries: { bowlerName: string; slug: string; score: number } | null;
  bowlerOfTheWeek: { bowlerName: string; slug: string; score: number } | null;
  teamOfTheWeek: { teamName: string; teamSlug: string; score: number } | null;
}

export const getCurrentSeasonSnapshot = cache(async (): Promise<SeasonSnapshot | null> => {
  return cachedQuery('getCurrentSeasonSnapshot', async () => {

    const db = await getDb();

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

    const statsResult = await db.request()
      .input('seasonID', season.seasonID)
      .query<{
        weekNumber: number;
        totalBowlers: number;
        leagueAverage: number;
        expectedLeagueAverage: number;
      }>(`
        SELECT
          MAX(sc.week) AS weekNumber,
          COUNT(DISTINCT sc.bowlerID) AS totalBowlers,
          CAST(SUM(sc.scratchSeries) * 1.0 / NULLIF(COUNT(sc.scoreID) * 3, 0) AS DECIMAL(5,1)) AS leagueAverage,
          CAST(AVG(CAST(sc.incomingAvg AS DECIMAL(5,1))) AS DECIMAL(5,1)) AS expectedLeagueAverage
        FROM scores sc
        WHERE sc.seasonID = @seasonID
          AND sc.isPenalty = 0
      `);

    const stats = statsResult.recordset[0];

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
          AND EXISTS (
            SELECT 1 FROM scores sc3
            WHERE sc3.bowlerID = sc.bowlerID AND sc3.isPenalty = 0
              AND (sc3.seasonID < sc.seasonID OR (sc3.seasonID = sc.seasonID AND sc3.week < sc.week))
          )
        ORDER BY sc.handSeries DESC
      `);

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
      slug: season.displayName.toLowerCase().replace(/ /g, '-'),
      weekNumber: stats?.weekNumber ?? 0,
      totalBowlers: stats?.totalBowlers ?? 0,
      leagueAverage: stats?.leagueAverage ?? 0,
      expectedLeagueAverage: stats?.expectedLeagueAverage ?? 0,
      topMaleAvg: topMaleAvgResult.recordset[0] ?? null,
      topFemaleAvg: topFemaleAvgResult.recordset[0] ?? null,
      topHcpAvg: topHcpAvgResult.recordset[0] ?? null,
      highGame: highGameResult.recordset[0] ?? null,
      highSeries: highSeriesResult.recordset[0] ?? null,
      bowlerOfTheWeek: botwResult.recordset[0] ?? null,
      teamOfTheWeek,
    };
  }, null);
});
