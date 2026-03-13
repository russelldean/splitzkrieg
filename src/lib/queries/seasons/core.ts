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
  }, null, { stable: true, sql: GET_SEASON_BY_SLUG_SQL });
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
