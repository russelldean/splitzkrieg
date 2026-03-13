/**
 * Team profile queries: basic team info, slugs, and current standing.
 */
import { cache } from 'react';
import { getDb, cachedQuery } from '../../db';

export interface TeamSlug {
  slug: string;
}

export interface Team {
  teamID: number;
  teamName: string;
  slug: string;
  captainBowlerID: number | null;
  captainName: string | null;
  captainSlug: string | null;
}

export interface TeamCurrentStanding {
  seasonSlug: string;
  seasonRoman: string;
  wins: number;
  losses: number;
  xp: number;
  totalPts: number;
  divisionRank: number;
  divisionSize: number;
  divisionName: string | null;
}

const GET_TEAM_CURRENT_STANDING_SQL = `
  WITH currentSeason AS (
    SELECT TOP 1 seasonID, romanNumeral,
      LOWER(REPLACE(displayName, ' ', '-')) AS seasonSlug
    FROM seasons
    ORDER BY year DESC, CASE period WHEN 'Fall' THEN 2 ELSE 1 END DESC
  ),
  teamPts AS (
    SELECT sch.team1ID AS teamID,
           SUM(mr.team1GamePts) AS gamePts,
           SUM(mr.team1BonusPts) AS xp
    FROM matchResults mr
    JOIN schedule sch ON mr.scheduleID = sch.scheduleID
    JOIN currentSeason cs ON sch.seasonID = cs.seasonID
    GROUP BY sch.team1ID
    UNION ALL
    SELECT sch.team2ID AS teamID,
           SUM(mr.team2GamePts) AS gamePts,
           SUM(mr.team2BonusPts) AS xp
    FROM matchResults mr
    JOIN schedule sch ON mr.scheduleID = sch.scheduleID
    JOIN currentSeason cs ON sch.seasonID = cs.seasonID
    GROUP BY sch.team2ID
  ),
  matchCounts AS (
    SELECT teamID, COUNT(*) AS matchWeeks FROM (
      SELECT sch.team1ID AS teamID
      FROM matchResults mr JOIN schedule sch ON mr.scheduleID = sch.scheduleID
      JOIN currentSeason cs ON sch.seasonID = cs.seasonID
      UNION ALL
      SELECT sch.team2ID AS teamID
      FROM matchResults mr JOIN schedule sch ON mr.scheduleID = sch.scheduleID
      JOIN currentSeason cs ON sch.seasonID = cs.seasonID
    ) x GROUP BY teamID
  ),
  standings AS (
    SELECT
      tp.teamID,
      CAST(SUM(tp.gamePts) AS DECIMAL(5,1)) / 2 AS wins,
      CAST(mc.matchWeeks * 3 - SUM(tp.gamePts) / 2.0 AS DECIMAL(5,1)) AS losses,
      SUM(tp.xp) AS xp,
      SUM(tp.gamePts) + SUM(tp.xp) AS totalPts,
      sd.divisionName
    FROM teamPts tp
    CROSS JOIN currentSeason cs
    LEFT JOIN seasonDivisions sd
      ON sd.seasonID = cs.seasonID AND sd.teamID = tp.teamID
    LEFT JOIN matchCounts mc ON mc.teamID = tp.teamID
    GROUP BY tp.teamID, sd.divisionName, mc.matchWeeks
  ),
  ranked AS (
    SELECT *,
      ROW_NUMBER() OVER (
        PARTITION BY COALESCE(divisionName, '__all__')
        ORDER BY totalPts DESC
      ) AS divisionRank,
      COUNT(*) OVER (
        PARTITION BY COALESCE(divisionName, '__all__')
      ) AS divisionSize
    FROM standings
  )
  SELECT
    cs.seasonSlug,
    cs.romanNumeral AS seasonRoman,
    r.wins,
    r.losses,
    r.xp,
    r.totalPts,
    r.divisionRank,
    r.divisionSize,
    r.divisionName
  FROM ranked r
  CROSS JOIN currentSeason cs
  WHERE r.teamID = @teamID
`;

export async function getTeamCurrentStanding(teamID: number): Promise<TeamCurrentStanding | null> {
  return cachedQuery(`getTeamCurrentStanding-${teamID}`, async () => {
    const db = await getDb();
    const result = await db
      .request()
      .input('teamID', teamID)
      .query<TeamCurrentStanding>(GET_TEAM_CURRENT_STANDING_SQL);
    return result.recordset[0] ?? null;
  }, null, { sql: GET_TEAM_CURRENT_STANDING_SQL, allSeasons: true });
}

const GET_ALL_TEAM_SLUGS_SQL = `
  SELECT slug FROM teams WHERE slug IS NOT NULL ORDER BY teamName
`;

export async function getAllTeamSlugs(): Promise<TeamSlug[]> {
  return cachedQuery('getAllTeamSlugs', async () => {
    const db = await getDb();
    const result = await db.request().query<TeamSlug>(GET_ALL_TEAM_SLUGS_SQL);
    return result.recordset;
  }, [], { stable: true, sql: GET_ALL_TEAM_SLUGS_SQL });
}

const GET_TEAM_BY_SLUG_SQL = `
  SELECT t.teamID, t.teamName, t.slug,
         t.captainBowlerID,
         b.bowlerName AS captainName,
         b.slug AS captainSlug
  FROM teams t
  LEFT JOIN bowlers b ON t.captainBowlerID = b.bowlerID
  WHERE t.slug = @slug
`;

export const getTeamBySlug = cache(async (slug: string): Promise<Team | null> => {
  return cachedQuery(`getTeamBySlug-${slug}`, async () => {
    const db = await getDb();
    const result = await db
      .request()
      .input('slug', slug)
      .query<Team>(GET_TEAM_BY_SLUG_SQL);
    return result.recordset[0] ?? null;
  }, null, { stable: true, sql: GET_TEAM_BY_SLUG_SQL });
});
