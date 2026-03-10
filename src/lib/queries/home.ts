/**
 * Home page queries: countdown, milestones, season snapshot.
 */
import { cache } from 'react';
import { getDb, cachedQuery } from '../db';

const GET_NEXT_BOWLING_NIGHT_SQL = `/* v2: skip today if past bowling time */
  SELECT TOP 1 matchDate
  FROM schedule
  WHERE matchDate > CAST(GETDATE() AS DATE)
  ORDER BY matchDate ASC
`;

export async function getNextBowlingNight(): Promise<string | null> {
  return cachedQuery('getNextBowlingNight', async () => {
    const db = await getDb();
    const result = await db.request().query<{ matchDate: Date }>(GET_NEXT_BOWLING_NIGHT_SQL);
    return result.recordset[0]?.matchDate?.toISOString() ?? null;
  }, null, { sql: GET_NEXT_BOWLING_NIGHT_SQL });
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

export interface TickerItem {
  text: string;
  href: string;
  icon: 'debut' | 'trophy' | 'star' | 'clock' | 'milestone';
}

const GET_RECENT_MILESTONES_SQL = `
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
`;

export const getRecentMilestones = cache(async (): Promise<Milestone[]> => {
  return cachedQuery('getRecentMilestones', async () => {
    const db = await getDb();
    const result = await db.request().query<Milestone>(GET_RECENT_MILESTONES_SQL);
    return result.recordset;
  }, [], { sql: GET_RECENT_MILESTONES_SQL });
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

const SNAPSHOT_SEASON_SQL = `
  SELECT TOP 1 seasonID, displayName, romanNumeral
  FROM seasons
  ORDER BY year DESC, CASE period WHEN 'Fall' THEN 2 ELSE 1 END DESC
`;

const SNAPSHOT_STATS_SQL = `
  WITH latestWeek AS (
    SELECT MAX(sc.week) AS wk FROM scores sc WHERE sc.seasonID = @seasonID AND sc.isPenalty = 0
  )
  SELECT
    lw.wk AS weekNumber,
    COUNT(DISTINCT sc.bowlerID) AS totalBowlers,
    CAST(SUM(sc.scratchSeries) * 1.0 / NULLIF(COUNT(sc.scoreID) * 3, 0) AS DECIMAL(5,1)) AS leagueAverage,
    CAST(AVG(CASE WHEN sc.incomingAvg > 0 THEN CAST(sc.incomingAvg AS DECIMAL(5,1)) END) AS DECIMAL(5,1)) AS expectedLeagueAverage
  FROM scores sc
  CROSS JOIN latestWeek lw
  WHERE sc.seasonID = @seasonID
    AND sc.isPenalty = 0
    AND sc.week = lw.wk
  GROUP BY lw.wk
`;

const SNAPSHOT_TOP_MALE_AVG_SQL = `
  SELECT TOP 1
    b.bowlerName, b.slug,
    CAST(SUM(sc.scratchSeries) * 1.0 / NULLIF(COUNT(sc.scoreID) * 3, 0) AS DECIMAL(5,1)) AS average
  FROM scores sc
  JOIN bowlers b ON sc.bowlerID = b.bowlerID
  WHERE sc.seasonID = @seasonID AND sc.isPenalty = 0 AND b.gender = 'M'
  GROUP BY sc.bowlerID, b.bowlerName, b.slug
  HAVING COUNT(sc.scoreID) >= 3
  ORDER BY average DESC
`;

const SNAPSHOT_TOP_FEMALE_AVG_SQL = `
  SELECT TOP 1
    b.bowlerName, b.slug,
    CAST(SUM(sc.scratchSeries) * 1.0 / NULLIF(COUNT(sc.scoreID) * 3, 0) AS DECIMAL(5,1)) AS average
  FROM scores sc
  JOIN bowlers b ON sc.bowlerID = b.bowlerID
  WHERE sc.seasonID = @seasonID AND sc.isPenalty = 0 AND b.gender = 'F'
  GROUP BY sc.bowlerID, b.bowlerName, b.slug
  HAVING COUNT(sc.scoreID) >= 3
  ORDER BY average DESC
`;

const SNAPSHOT_TOP_HCP_AVG_SQL = `
  SELECT TOP 1
    b.bowlerName, b.slug,
    CAST(SUM(sc.handSeries) * 1.0 / NULLIF(COUNT(sc.scoreID) * 3, 0) AS DECIMAL(5,1)) AS average
  FROM scores sc
  JOIN bowlers b ON sc.bowlerID = b.bowlerID
  WHERE sc.seasonID = @seasonID AND sc.isPenalty = 0
  GROUP BY sc.bowlerID, b.bowlerName, b.slug
  HAVING COUNT(sc.scoreID) >= 3
  ORDER BY average DESC
`;

const SNAPSHOT_HIGH_GAME_SQL = `
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
`;

const SNAPSHOT_HIGH_SERIES_SQL = `
  SELECT TOP 1
    b.bowlerName,
    b.slug,
    sc.scratchSeries AS score
  FROM scores sc
  JOIN bowlers b ON sc.bowlerID = b.bowlerID
  WHERE sc.seasonID = @seasonID
    AND sc.isPenalty = 0
  ORDER BY sc.scratchSeries DESC
`;

const SNAPSHOT_BOTW_SQL = `
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
`;

const SNAPSHOT_TOTW_SQL = `
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
`;

const SNAPSHOT_ALL_SQL = SNAPSHOT_SEASON_SQL + SNAPSHOT_STATS_SQL + SNAPSHOT_TOP_MALE_AVG_SQL
  + SNAPSHOT_TOP_FEMALE_AVG_SQL + SNAPSHOT_TOP_HCP_AVG_SQL + SNAPSHOT_HIGH_GAME_SQL
  + SNAPSHOT_HIGH_SERIES_SQL + SNAPSHOT_BOTW_SQL + SNAPSHOT_TOTW_SQL;

export const getCurrentSeasonSnapshot = cache(async (): Promise<SeasonSnapshot | null> => {
  return cachedQuery('getCurrentSeasonSnapshot-v2', async () => {

    const db = await getDb();

    const seasonResult = await db.request().query<{
      seasonID: number;
      displayName: string;
      romanNumeral: string;
    }>(SNAPSHOT_SEASON_SQL);

    const season = seasonResult.recordset[0];
    if (!season) return null;

    const statsResult = await db.request()
      .input('seasonID', season.seasonID)
      .query<{
        weekNumber: number;
        totalBowlers: number;
        leagueAverage: number;
        expectedLeagueAverage: number;
      }>(SNAPSHOT_STATS_SQL);

    const stats = statsResult.recordset[0];

    const topMaleAvgResult = await db.request()
      .input('seasonID', season.seasonID)
      .query<{ bowlerName: string; slug: string; average: number }>(SNAPSHOT_TOP_MALE_AVG_SQL);

    const topFemaleAvgResult = await db.request()
      .input('seasonID', season.seasonID)
      .query<{ bowlerName: string; slug: string; average: number }>(SNAPSHOT_TOP_FEMALE_AVG_SQL);

    const topHcpAvgResult = await db.request()
      .input('seasonID', season.seasonID)
      .query<{ bowlerName: string; slug: string; average: number }>(SNAPSHOT_TOP_HCP_AVG_SQL);

    const highGameResult = await db.request()
      .input('seasonID', season.seasonID)
      .query<{ bowlerName: string; slug: string; score: number }>(SNAPSHOT_HIGH_GAME_SQL);

    const highSeriesResult = await db.request()
      .input('seasonID', season.seasonID)
      .query<{ bowlerName: string; slug: string; score: number }>(SNAPSHOT_HIGH_SERIES_SQL);

    const botwResult = await db.request()
      .input('seasonID', season.seasonID)
      .query<{ bowlerName: string; slug: string; score: number }>(SNAPSHOT_BOTW_SQL);

    const totwResult = await db.request()
      .input('seasonID', season.seasonID)
      .query<{ teamName: string; teamSlug: string; totalHandSeries: number }>(SNAPSHOT_TOTW_SQL);
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
  }, null, { sql: SNAPSHOT_ALL_SQL });
});

/**
 * Weekly highlights for the ticker: debuts, all-time high games, all-time high series.
 * Pulls from the most recent week of the current season.
 */

const HIGHLIGHTS_LATEST_WEEK_SQL = `
  SELECT TOP 1 sc.seasonID, sc.week
  FROM scores sc
  JOIN seasons s ON sc.seasonID = s.seasonID
  WHERE sc.isPenalty = 0
  ORDER BY s.year DESC, CASE s.period WHEN 'Fall' THEN 2 ELSE 1 END DESC, sc.week DESC
`;

const HIGHLIGHTS_SCORES_SQL = `
  SELECT
    b.bowlerName,
    b.slug,
    sc.game1,
    sc.game2,
    sc.game3,
    sc.scratchSeries,
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
  WHERE sc.seasonID = @seasonID
    AND sc.week = @week
    AND sc.isPenalty = 0
`;

const HIGHLIGHTS_ALL_SQL = HIGHLIGHTS_LATEST_WEEK_SQL + HIGHLIGHTS_SCORES_SQL;

export const getWeeklyHighlights = cache(async (): Promise<TickerItem[]> => {
  return cachedQuery('getWeeklyHighlights', async () => {
    const db = await getDb();

    // Get current season + latest week
    const latestResult = await db.request().query<{ seasonID: number; week: number }>(HIGHLIGHTS_LATEST_WEEK_SQL);
    const latest = latestResult.recordset[0];
    if (!latest) return [];

    // Get scores for that week with prior bests and debut flag
    const result = await db.request()
      .input('seasonID', latest.seasonID)
      .input('week', latest.week)
      .query<{
        bowlerName: string;
        slug: string;
        game1: number | null;
        game2: number | null;
        game3: number | null;
        scratchSeries: number;
        isFirstNight: number;
        priorBestGame: number | null;
        priorBestSeries: number | null;
      }>(HIGHLIGHTS_SCORES_SQL);

    const items: TickerItem[] = [];

    for (const row of result.recordset) {
      const href = `/bowler/${row.slug}`;

      // Debut
      if (row.isFirstNight === 1) {
        items.push({
          text: `${row.bowlerName} made their Splitzkrieg debut!`,
          href,
          icon: 'debut',
        });
        continue; // no prior bests to compare for first-nighters
      }

      // All-time high game
      const bestGameThisWeek = Math.max(
        row.game1 ?? 0,
        row.game2 ?? 0,
        row.game3 ?? 0,
      );
      if (row.priorBestGame !== null && bestGameThisWeek > row.priorBestGame) {
        items.push({
          text: `${row.bowlerName}: New High Game — ${bestGameThisWeek}`,
          href,
          icon: 'trophy',
        });
      }

      // All-time high series
      if (row.priorBestSeries !== null && row.scratchSeries > row.priorBestSeries) {
        items.push({
          text: `${row.bowlerName}: New High Series — ${row.scratchSeries}`,
          href,
          icon: 'star',
        });
      }
    }

    return items;
  }, [], { sql: HIGHLIGHTS_ALL_SQL });
});
