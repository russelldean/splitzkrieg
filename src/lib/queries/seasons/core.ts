/**
 * Season core queries: lookups, navigation, and directory.
 */
import { cache } from 'react';
import { getDb, cachedQuery } from '../../db';

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
  notes: string | null;
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

export interface SeasonNav {
  seasonID: number;
  slug: string;
  romanNumeral: string;
  displayName: string;
  year: number;
  period: string;
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
    LOWER(REPLACE(displayName, ' ', '-')) AS slug,
    notes
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
    // throwOnError: a DB failure must 500 (retryable), not return null -> notFound() -> cached 404.
  }, null, { sql: GET_SEASON_BY_SLUG_SQL, stable: true, throwOnError: true });
});

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
  }, [], { sql: GET_ALL_SEASONS_DIRECTORY_SQL, dependsOn: ['scores'] });
});

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

export interface DataCompleteness {
  totalNights: number;
  nightsWithData: number;
  missingWeeks: string[];
}

const TOTAL_LEAGUE_NIGHTS_SQL = `
  SELECT
    (SELECT SUM(weekCount) FROM seasons WHERE isCurrentSeason = 0)
    + (SELECT COUNT(*) FROM (
        SELECT week FROM scores WHERE seasonID = (SELECT seasonID FROM seasons WHERE isCurrentSeason = 1)
          AND isPenalty = 0 GROUP BY week HAVING COUNT(*) >= 4
      ) t)
    AS totalNights,
    (SELECT COUNT(*) FROM (
      SELECT seasonID, week FROM scores WHERE isPenalty = 0
      GROUP BY seasonID, week HAVING COUNT(*) >= 4
    ) t) AS nightsWithData
`;

const MISSING_WEEKS_SQL = `
  SELECT DISTINCT se.romanNumeral, sc.week
  FROM schedule sc
  JOIN seasons se ON sc.seasonID = se.seasonID
  WHERE sc.team1ID IS NOT NULL
    AND (SELECT COUNT(*) FROM scores s WHERE s.seasonID = sc.seasonID AND s.week = sc.week AND s.isPenalty = 0) < 4
    AND NOT (se.isCurrentSeason = 1 AND sc.week > (
      SELECT ISNULL(MAX(s2.week), 0) FROM scores s2
      WHERE s2.seasonID = se.seasonID AND s2.isPenalty = 0
    ))
  ORDER BY se.romanNumeral, sc.week
`;

export const getDataCompleteness = cache(async (): Promise<DataCompleteness> => {
  return cachedQuery('getDataCompleteness', async () => {
    const db = await getDb();
    const [stats, missing] = await Promise.all([
      db.request().query<{ totalNights: number; nightsWithData: number }>(TOTAL_LEAGUE_NIGHTS_SQL),
      db.request().query<{ romanNumeral: string; week: number }>(MISSING_WEEKS_SQL),
    ]);
    const row = stats.recordset[0];
    return {
      totalNights: row.totalNights,
      nightsWithData: row.nightsWithData,
      missingWeeks: missing.recordset.map(r => `Season ${r.romanNumeral} Week ${r.week}`),
    };
  }, { totalNights: 0, nightsWithData: 0, missingWeeks: [] }, { sql: TOTAL_LEAGUE_NIGHTS_SQL + MISSING_WEEKS_SQL, dependsOn: ['scores'] });
});

const TOTAL_PINS_SQL = `SELECT SUM(CAST(game1 AS BIGINT) + CAST(game2 AS BIGINT) + CAST(game3 AS BIGINT)) as totalPins
  FROM scores WHERE isPenalty = 0`;

export const getTotalPinsKnockedDown = cache(async (): Promise<number> => {
  const rows = await cachedQuery<{ totalPins: number }[]>('getTotalPinsKnockedDown', async () => {
    const db = await getDb();
    const result = await db.request().query<{ totalPins: number }>(TOTAL_PINS_SQL);
    return [...result.recordset];
  }, [], { sql: TOTAL_PINS_SQL, dependsOn: ['scores'] });
  return rows[0]?.totalPins ?? 0;
});

/* ───────────────────────────────────────────────────────────
 * League-wide cumulative stats (for About page)
 * ─────────────────────────────────────────────────────────── */

export interface LeagueStats {
  totalSeasons: number;
  totalBowlers: number;
  totalTeams: number;
  totalGames: number;
  totalPins: number;
  totalTurkeys: number;
  games200Plus: number;
  games300: number;
  series600Plus: number;
  series700Plus: number;
  perfectSeriesCount: number;
  highGame: number;
  highSeries: number;
  bowlersWithTurkey: number;
  bowlersWith200: number;
  bowlersWith300: number;
  bowlersWith600: number;
  bowlersWith700: number;
  distinctChampionTeams: number;
}

// All-time "by the numbers" for the about page. The non-distinct figures (sums, plain
// counts, maxes) collapse into ONE scan of scores (the inner `s` subquery) instead of
// ~12 separate full scans. The 6 COUNT(DISTINCT bowlerID ...) stay as their own
// subqueries ON PURPOSE: folding them into the single pass forced 6 distinct-sorts over
// the whole scan and measured SLOWER; as separate subqueries they each get index-assisted
// seeks. totalBowlers / totalTeams / totalSeasons / distinctChampionTeams are small,
// non-scores counts. Verified identical to the all-subquery version; ~1.05s -> ~0.55s.
const LEAGUE_STATS_SQL = `
  SELECT
    (SELECT COUNT(*) FROM seasons) AS totalSeasons,
    (SELECT COUNT(DISTINCT bowlerID) FROM scores WHERE isPenalty = 0) AS totalBowlers,
    (SELECT COUNT(*) FROM teams) AS totalTeams,
    s.totalGames,
    s.totalPins,
    s.totalTurkeys,
    s.games200Plus,
    s.games300,
    s.series600Plus,
    s.series700Plus,
    s.perfectSeriesCount,
    (SELECT MAX(v) FROM (VALUES (s.maxG1), (s.maxG2), (s.maxG3)) AS g(v)) AS highGame,
    s.highSeries,
    (SELECT COUNT(DISTINCT bowlerID) FROM scores WHERE isPenalty = 0 AND ISNULL(turkeys, 0) > 0) AS bowlersWithTurkey,
    (SELECT COUNT(DISTINCT bowlerID) FROM scores WHERE isPenalty = 0 AND (game1 >= 200 OR game2 >= 200 OR game3 >= 200)) AS bowlersWith200,
    (SELECT COUNT(DISTINCT bowlerID) FROM scores WHERE isPenalty = 0 AND (game1 = 300 OR game2 = 300 OR game3 = 300)) AS bowlersWith300,
    (SELECT COUNT(DISTINCT bowlerID) FROM scores WHERE isPenalty = 0 AND scratchSeries >= 600) AS bowlersWith600,
    (SELECT COUNT(DISTINCT bowlerID) FROM scores WHERE isPenalty = 0 AND scratchSeries >= 700) AS bowlersWith700,
    (SELECT COUNT(DISTINCT winnerTeamID) FROM seasonChampions WHERE championshipType = 'team' AND winnerTeamID IS NOT NULL) AS distinctChampionTeams
  FROM (
    SELECT
      COUNT(*) * 3 AS totalGames,
      SUM(CAST(game1 AS BIGINT) + CAST(game2 AS BIGINT) + CAST(game3 AS BIGINT)) AS totalPins,
      SUM(ISNULL(turkeys, 0)) AS totalTurkeys,
      SUM(
        CASE WHEN game1 >= 200 THEN 1 ELSE 0 END +
        CASE WHEN game2 >= 200 THEN 1 ELSE 0 END +
        CASE WHEN game3 >= 200 THEN 1 ELSE 0 END
      ) AS games200Plus,
      SUM(
        CASE WHEN game1 = 300 THEN 1 ELSE 0 END +
        CASE WHEN game2 = 300 THEN 1 ELSE 0 END +
        CASE WHEN game3 = 300 THEN 1 ELSE 0 END
      ) AS games300,
      SUM(CASE WHEN scratchSeries >= 600 THEN 1 ELSE 0 END) AS series600Plus,
      SUM(CASE WHEN scratchSeries >= 700 THEN 1 ELSE 0 END) AS series700Plus,
      SUM(CASE WHEN scratchSeries = 900 THEN 1 ELSE 0 END) AS perfectSeriesCount,
      MAX(game1) AS maxG1,
      MAX(game2) AS maxG2,
      MAX(game3) AS maxG3,
      MAX(scratchSeries) AS highSeries
    FROM scores WHERE isPenalty = 0
  ) s
`;

export const getLeagueStats = cache(async (): Promise<LeagueStats> => {
  return cachedQuery(
    'getLeagueStats',
    async () => {
      const db = await getDb();
      const result = await db.request().query<LeagueStats>(LEAGUE_STATS_SQL);
      return result.recordset[0];
    },
    {
      totalSeasons: 0, totalBowlers: 0, totalTeams: 0, totalGames: 0,
      totalPins: 0, totalTurkeys: 0, games200Plus: 0, games300: 0,
      series600Plus: 0, series700Plus: 0, perfectSeriesCount: 0,
      highGame: 0, highSeries: 0,
      bowlersWithTurkey: 0, bowlersWith200: 0, bowlersWith300: 0,
      bowlersWith600: 0, bowlersWith700: 0, distinctChampionTeams: 0,
    },
    { sql: LEAGUE_STATS_SQL, dependsOn: ['scores'] },
  );
});
