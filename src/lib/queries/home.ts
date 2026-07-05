/**
 * Home page queries: countdown, milestones, season snapshot.
 */
import { cache } from 'react';
import { getDb, cachedQuery } from '../db';

const BADGE_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

/** Check if the "new blog post" badge should show. Returns slug or null. */
export async function getNewBlogBadgeId(): Promise<string | null> {
  try {
    const db = await getDb();
    const result = await db.request().query<{ settingValue: string }>(
      `SELECT settingValue FROM leagueSettings WHERE settingKey = 'newBlogPost'`
    );
    const val = result.recordset[0]?.settingValue ?? '0';
    if (val === '0') return null;
    // Format: "slug|timestamp"
    const [slug, ts] = val.split('|');
    if (!slug) return null;
    // Auto-expire after 14 days
    if (ts && Date.now() - parseInt(ts, 10) > BADGE_TTL_MS) return null;
    // Return full value (slug|ts) as badge ID so re-promoting resets localStorage
    return val;
  } catch {
    return null;
  }
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

const getRecentMilestones = cache(async (): Promise<Milestone[]> => {
  return cachedQuery('getRecentMilestones', async () => {
    const db = await getDb();
    const result = await db.request().query<Milestone>(GET_RECENT_MILESTONES_SQL);
    return result.recordset;
  }, [], { sql: GET_RECENT_MILESTONES_SQL, dependsOn: ['scores'] });
});

// ── Published week resolver ─────────────────────────────────
// Tries leagueSettings first; falls back to MAX(week) if table missing.

interface PublishedContext {
  seasonID: number;
  displayName: string;
  romanNumeral: string;
  week: number;
}

const CURRENT_SEASON_SQL = `
  SELECT TOP 1 seasonID, displayName, romanNumeral
  FROM seasons
  ORDER BY year DESC, CASE period WHEN 'Fall' THEN 2 ELSE 1 END DESC
`;

// Memoized per-build so downstream queries can use the resolved week in their cache keys.
let _publishedContextPromise: Promise<PublishedContext | null> | null = null;

export function getPublishedContext(): Promise<PublishedContext | null> {
  if (!_publishedContextPromise) {
    _publishedContextPromise = _resolvePublishedContext();
  }
  return _publishedContextPromise;
}

async function _resolvePublishedContext(): Promise<PublishedContext | null> {
  const db = await getDb();
  const seasonResult = await db.request().query<{
    seasonID: number; displayName: string; romanNumeral: string;
  }>(CURRENT_SEASON_SQL);
  const season = seasonResult.recordset[0];
  if (!season) return null;

  let week: number | null = null;
  try {
    const lsResult = await db.request().query<{ settingValue: string }>(
      `SELECT settingValue FROM leagueSettings WHERE settingKey = 'publishedWeek'`
    );
    if (lsResult.recordset[0]) week = parseInt(lsResult.recordset[0].settingValue, 10);
  } catch {
    // table doesn't exist yet — fall through
  }

  if (week == null) {
    const maxResult = await db.request()
      .input('seasonID', season.seasonID)
      .query<{ maxWeek: number }>(
        `SELECT MAX(week) AS maxWeek FROM scores WHERE seasonID = @seasonID AND isPenalty = 0`
      );
    week = maxResult.recordset[0]?.maxWeek ?? 0;
  }

  return { ...season, week };
}

// ── Season Snapshot ─────────────────────────────────────────

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
  bowlersOfTheWeek: Array<{ bowlerName: string; slug: string; score: number }>;
  teamOfTheWeek: { teamName: string; teamSlug: string; score: number } | null;
}

const SNAPSHOT_STATS_SQL = `/* v4: week passed as param */
  SELECT
    @week AS weekNumber,
    COUNT(DISTINCT sc.bowlerID) AS totalBowlers,
    CAST(SUM(sc.scratchSeries) * 1.0 / NULLIF(COUNT(sc.scoreID) * 3, 0) AS DECIMAL(5,1)) AS leagueAverage,
    CAST(AVG(CASE WHEN sc.incomingAvg > 0 THEN CAST(sc.incomingAvg AS DECIMAL(5,1)) END) AS DECIMAL(5,1)) AS expectedLeagueAverage
  FROM scores sc
  WHERE sc.seasonID = @seasonID
    AND sc.isPenalty = 0
    AND sc.week = @week
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

const SNAPSHOT_BOTW_SQL = `/* v4: co-winners on ties */
  SELECT b.bowlerName, b.slug, sc.handSeries AS score
  FROM scores sc
  JOIN bowlers b ON sc.bowlerID = b.bowlerID
  WHERE sc.seasonID = @seasonID
    AND sc.isPenalty = 0
    AND sc.week = @week
    AND sc.handSeries = (
      SELECT MAX(sc2.handSeries) FROM scores sc2
      WHERE sc2.seasonID = @seasonID AND sc2.week = @week AND sc2.isPenalty = 0
    )
  ORDER BY b.bowlerName
`;

const SNAPSHOT_TOTW_SQL = `/* v3: week passed as param */
  SELECT TOP 1
    t.teamName,
    t.slug AS teamSlug,
    SUM(sc.handSeries) AS totalHandSeries
  FROM scores sc
  JOIN teams t ON sc.teamID = t.teamID
  WHERE sc.seasonID = @seasonID
    AND sc.isPenalty = 0
    AND sc.teamID IS NOT NULL
    AND sc.week = @week
  GROUP BY sc.teamID, t.teamName, t.slug
  ORDER BY totalHandSeries DESC
`;

const SNAPSHOT_ALL_SQL = CURRENT_SEASON_SQL + SNAPSHOT_STATS_SQL + SNAPSHOT_TOP_MALE_AVG_SQL
  + SNAPSHOT_TOP_FEMALE_AVG_SQL + SNAPSHOT_TOP_HCP_AVG_SQL + SNAPSHOT_HIGH_GAME_SQL
  + SNAPSHOT_HIGH_SERIES_SQL + SNAPSHOT_BOTW_SQL + SNAPSHOT_TOTW_SQL;

export const getCurrentSeasonSnapshot = cache(async (): Promise<SeasonSnapshot | null> => {
  const ctx = await getPublishedContext();
  if (!ctx || ctx.week === 0) return null;

  return cachedQuery('getCurrentSeasonSnapshot', async () => {

    const db = await getDb();
    const req = () => db.request().input('seasonID', ctx.seasonID).input('week', ctx.week);

    const [statsResult, topMaleAvgResult, topFemaleAvgResult, topHcpAvgResult, highGameResult, highSeriesResult, botwResult, totwResult] = await Promise.all([
      req().query<{ weekNumber: number; totalBowlers: number; leagueAverage: number; expectedLeagueAverage: number }>(SNAPSHOT_STATS_SQL),
      req().query<{ bowlerName: string; slug: string; average: number }>(SNAPSHOT_TOP_MALE_AVG_SQL),
      req().query<{ bowlerName: string; slug: string; average: number }>(SNAPSHOT_TOP_FEMALE_AVG_SQL),
      req().query<{ bowlerName: string; slug: string; average: number }>(SNAPSHOT_TOP_HCP_AVG_SQL),
      req().query<{ bowlerName: string; slug: string; score: number }>(SNAPSHOT_HIGH_GAME_SQL),
      req().query<{ bowlerName: string; slug: string; score: number }>(SNAPSHOT_HIGH_SERIES_SQL),
      req().query<{ bowlerName: string; slug: string; score: number }>(SNAPSHOT_BOTW_SQL),
      req().query<{ teamName: string; teamSlug: string; totalHandSeries: number }>(SNAPSHOT_TOTW_SQL),
    ]);

    const stats = statsResult.recordset[0];
    const totwRow = totwResult.recordset[0];
    const teamOfTheWeek: SeasonSnapshot['teamOfTheWeek'] = totwRow
      ? { teamName: totwRow.teamName, teamSlug: totwRow.teamSlug, score: totwRow.totalHandSeries }
      : null;

    return {
      seasonID: ctx.seasonID,
      displayName: ctx.displayName,
      romanNumeral: ctx.romanNumeral,
      slug: ctx.displayName.toLowerCase().replace(/ /g, '-'),
      weekNumber: stats?.weekNumber ?? ctx.week,
      totalBowlers: stats?.totalBowlers ?? 0,
      leagueAverage: stats?.leagueAverage ?? 0,
      expectedLeagueAverage: stats?.expectedLeagueAverage ?? 0,
      topMaleAvg: topMaleAvgResult.recordset[0] ?? null,
      topFemaleAvg: topFemaleAvgResult.recordset[0] ?? null,
      topHcpAvg: topHcpAvgResult.recordset[0] ?? null,
      highGame: highGameResult.recordset[0] ?? null,
      highSeries: highSeriesResult.recordset[0] ?? null,
      bowlersOfTheWeek: botwResult.recordset,
      teamOfTheWeek,
    };
  }, null, { sql: SNAPSHOT_ALL_SQL, dependsOn: ['scores'], includePublishedTag: true });
});

/**
 * Weekly highlights for the ticker: debuts, all-time high games, all-time high series.
 * Pulls from the most recent published week of the current season.
 */

// Current week's non-penalty scores plus each bowler's pre-week personal bests, used
// by the home ticker to flag debuts / new-high-game / new-high-series. Every output
// row shares the same (season, week) boundary, so the prior bests are ONE aggregate
// over non-penalty history strictly before this week (priorAgg CTE, joined once) - not
// 3 correlated subqueries scanning history per row (the old shape, ~1.5s cold / 33s
// under build contention). isFirstNight = bowler absent from priorAgg. Verified
// row-for-row identical to the correlated version across seasons/weeks.
const HIGHLIGHTS_SCORES_SQL = `
  WITH priorAgg AS (
    SELECT sp.bowlerID,
           MAX(x.val)            AS priorBestGame,
           MAX(sp.scratchSeries) AS priorBestSeries
    FROM scores sp
    CROSS APPLY (VALUES (sp.game1),(sp.game2),(sp.game3)) AS x(val)
    WHERE sp.isPenalty = 0
      AND (sp.seasonID < @seasonID OR (sp.seasonID = @seasonID AND sp.week < @week))
    GROUP BY sp.bowlerID
  )
  SELECT
    b.bowlerName,
    b.slug,
    b.chronoNumber,
    sc.game1,
    sc.game2,
    sc.game3,
    sc.scratchSeries,
    CASE WHEN pa.bowlerID IS NULL THEN 1 ELSE 0 END AS isFirstNight,
    pa.priorBestGame,
    pa.priorBestSeries
  FROM scores sc
  JOIN bowlers b ON sc.bowlerID = b.bowlerID
  LEFT JOIN priorAgg pa ON pa.bowlerID = sc.bowlerID
  WHERE sc.seasonID = @seasonID
    AND sc.week = @week
    AND sc.isPenalty = 0
`;

export const getWeeklyHighlights = cache(async (): Promise<TickerItem[]> => {
  const ctx = await getPublishedContext();
  if (!ctx || ctx.week === 0) return [];

  return cachedQuery('getWeeklyHighlights', async () => {

    const db = await getDb();
    const result = await db.request()
      .input('seasonID', ctx.seasonID)
      .input('week', ctx.week)
      .query<{
        bowlerName: string;
        slug: string;
        chronoNumber: number | null;
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
          text: `${row.bowlerName} made their Splitzkrieg debut${row.chronoNumber ? ` - Bowler #${row.chronoNumber}` : ''}!`,
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
          text: `${row.bowlerName}: New High Game - ${bestGameThisWeek}`,
          href,
          icon: 'trophy',
        });
      }

      // All-time high series
      if (row.priorBestSeries !== null && row.scratchSeries > row.priorBestSeries) {
        items.push({
          text: `${row.bowlerName}: New High Series - ${row.scratchSeries}`,
          href,
          icon: 'star',
        });
      }
    }

    return items;
  }, [], { sql: HIGHLIGHTS_SCORES_SQL, dependsOn: ['scores'], includePublishedTag: true });
});
