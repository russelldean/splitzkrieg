/**
 * Team roster queries: current roster, all-time roster, season bowlers.
 */
import { getDb, cachedQuery } from '../../db';

export interface TeamRosterMember {
  bowlerID: number;
  bowlerName: string;
  slug: string;
  gamesBowled: number;
  seasonAverage: number | null;
  firstSeason: string | null;
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
  firstSeason: string | null;
  lastSeason: string | null;
}

const GET_TEAM_CURRENT_ROSTER_SQL = `
  SELECT
    b.bowlerID,
    b.bowlerName,
    b.slug,
    COUNT(sc.scoreID) * 3 AS gamesBowled,
    CAST(
      SUM(sc.scratchSeries) * 1.0 /
      NULLIF(COUNT(sc.scoreID) * 3, 0)
    AS DECIMAL(5,1)) AS seasonAverage,
    (
      SELECT TOP 1 sn.displayName
      FROM scores sc2
      JOIN seasons sn ON sc2.seasonID = sn.seasonID
      WHERE sc2.bowlerID = b.bowlerID AND sc2.teamID = @teamID AND sc2.isPenalty = 0
      ORDER BY sn.year ASC, CASE sn.period WHEN 'Fall' THEN 2 ELSE 1 END ASC
    ) AS firstSeason
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
`;

export async function getTeamCurrentRoster(teamID: number): Promise<TeamRosterMember[]> {
  return cachedQuery(`getTeamCurrentRoster-${teamID}`, async () => {
    const db = await getDb();
    const result = await db
      .request()
      .input('teamID', teamID)
      .query<TeamRosterMember>(GET_TEAM_CURRENT_ROSTER_SQL);
    return result.recordset;
  }, [], { sql: GET_TEAM_CURRENT_ROSTER_SQL, dependsOn: ['scores'] });
}

const GET_TEAM_SEASON_BOWLERS_SQL = `
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
`;

export async function getTeamSeasonBowlers(teamID: number, seasonID: number): Promise<TeamSeasonBowler[]> {
  return cachedQuery(`getTeamSeasonBowlers-${teamID}-${seasonID}`, async () => {
    const db = await getDb();
    const result = await db
      .request()
      .input('teamID', teamID)
      .input('seasonID', seasonID)
      .query<TeamSeasonBowler>(GET_TEAM_SEASON_BOWLERS_SQL);
    return result.recordset;
  }, [], { sql: GET_TEAM_SEASON_BOWLERS_SQL, seasonID });
}

const GET_TEAM_ALL_TIME_ROSTER_SQL = `
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
    COUNT(DISTINCT sc.seasonID) AS seasonsWithTeam,
    (
      SELECT TOP 1 sn.displayName
      FROM scores sc2
      JOIN seasons sn ON sc2.seasonID = sn.seasonID
      WHERE sc2.bowlerID = b.bowlerID AND sc2.teamID = @teamID AND sc2.isPenalty = 0
      ORDER BY sn.year ASC, CASE sn.period WHEN 'Fall' THEN 2 ELSE 1 END ASC
    ) AS firstSeason,
    (
      SELECT TOP 1 sn.displayName
      FROM scores sc2
      JOIN seasons sn ON sc2.seasonID = sn.seasonID
      WHERE sc2.bowlerID = b.bowlerID AND sc2.teamID = @teamID AND sc2.isPenalty = 0
      ORDER BY sn.year DESC, CASE sn.period WHEN 'Fall' THEN 2 ELSE 1 END DESC
    ) AS lastSeason
  FROM scores sc
  JOIN bowlers b ON sc.bowlerID = b.bowlerID
  WHERE sc.teamID = @teamID
    AND sc.isPenalty = 0
  GROUP BY b.bowlerID, b.bowlerName, b.slug
  ORDER BY totalGames DESC, average DESC
`;

export async function getTeamAllTimeRoster(teamID: number): Promise<AllTimeRosterMember[]> {
  return cachedQuery(`getTeamAllTimeRoster-${teamID}`, async () => {
    const db = await getDb();
    const result = await db
      .request()
      .input('teamID', teamID)
      .query<AllTimeRosterMember>(GET_TEAM_ALL_TIME_ROSTER_SQL);
    return result.recordset;
  }, [], { sql: GET_TEAM_ALL_TIME_ROSTER_SQL, dependsOn: ['scores'] });
}
