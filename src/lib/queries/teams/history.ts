/**
 * Team history queries: season-by-season, franchise names, directory, presence, playoffs.
 */
import { cache } from 'react';
import { getDb, cachedQuery } from '../../db';

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
  isChampion: boolean;
  wins: number | null;
  losses: number | null;
  ties: number | null;
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
  establishedSeason: string | null;
  championships: number;
}

export interface TeamSeasonPresence {
  teamID: number;
  teamName: string;
  slug: string;
  chronoNumber: number | null;
  seasonID: number;
  seasonSlug: string;
  romanNumeral: string;
}

export interface TeamPlayoffFinish {
  teamID: number;
  seasonID: number;
  finish: 'champion' | 'runner-up' | 'semifinalist';
}

const GET_TEAM_SEASON_BY_SEASON_SQL = `
  WITH teamGameResults AS (
    SELECT sch.seasonID,
      CASE WHEN mr.team1Game1 > mr.team2Game1 THEN 1 ELSE 0 END
        + CASE WHEN mr.team1Game2 > mr.team2Game2 THEN 1 ELSE 0 END
        + CASE WHEN mr.team1Game3 > mr.team2Game3 THEN 1 ELSE 0 END AS wins,
      CASE WHEN mr.team1Game1 < mr.team2Game1 THEN 1 ELSE 0 END
        + CASE WHEN mr.team1Game2 < mr.team2Game2 THEN 1 ELSE 0 END
        + CASE WHEN mr.team1Game3 < mr.team2Game3 THEN 1 ELSE 0 END AS losses,
      CASE WHEN mr.team1Game1 = mr.team2Game1 THEN 1 ELSE 0 END
        + CASE WHEN mr.team1Game2 = mr.team2Game2 THEN 1 ELSE 0 END
        + CASE WHEN mr.team1Game3 = mr.team2Game3 THEN 1 ELSE 0 END AS ties
    FROM matchResults mr
    JOIN schedule sch ON mr.scheduleID = sch.scheduleID
    WHERE sch.team1ID = @teamID
    UNION ALL
    SELECT sch.seasonID,
      CASE WHEN mr.team2Game1 > mr.team1Game1 THEN 1 ELSE 0 END
        + CASE WHEN mr.team2Game2 > mr.team1Game2 THEN 1 ELSE 0 END
        + CASE WHEN mr.team2Game3 > mr.team1Game3 THEN 1 ELSE 0 END AS wins,
      CASE WHEN mr.team2Game1 < mr.team1Game1 THEN 1 ELSE 0 END
        + CASE WHEN mr.team2Game2 < mr.team1Game2 THEN 1 ELSE 0 END
        + CASE WHEN mr.team2Game3 < mr.team1Game3 THEN 1 ELSE 0 END AS losses,
      CASE WHEN mr.team2Game1 = mr.team1Game1 THEN 1 ELSE 0 END
        + CASE WHEN mr.team2Game2 = mr.team1Game2 THEN 1 ELSE 0 END
        + CASE WHEN mr.team2Game3 = mr.team1Game3 THEN 1 ELSE 0 END AS ties
    FROM matchResults mr
    JOIN schedule sch ON mr.scheduleID = sch.scheduleID
    WHERE sch.team2ID = @teamID
  ),
  seasonRecord AS (
    SELECT seasonID, SUM(wins) AS wins, SUM(losses) AS losses, SUM(ties) AS ties
    FROM teamGameResults
    GROUP BY seasonID
  )
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
    ) THEN 1 ELSE 0 END AS BIT)                       AS hasScheduleData,
    CAST(CASE WHEN EXISTS (
      SELECT 1 FROM seasonChampions ch
      WHERE ch.winnerTeamID = @teamID
        AND ch.seasonID = sc.seasonID
        AND ch.championshipType = 'Team'
    ) THEN 1 ELSE 0 END AS BIT)                       AS isChampion,
    sr.wins,
    sr.losses,
    sr.ties
  FROM scores sc
  JOIN seasons sn ON sc.seasonID = sn.seasonID
  JOIN teams t ON t.teamID = @teamID
  LEFT JOIN teamNameHistory tnh
    ON  tnh.seasonID = sc.seasonID
    AND tnh.teamID   = @teamID
  LEFT JOIN seasonRecord sr ON sr.seasonID = sc.seasonID
  WHERE sc.teamID = @teamID
    AND sc.isPenalty = 0
  GROUP BY
    sc.seasonID, sn.displayName, sn.romanNumeral,
    sn.year, sn.period,
    COALESCE(tnh.teamName, t.teamName),
    sr.wins, sr.losses, sr.ties
  ORDER BY
    sn.year DESC,
    CASE sn.period WHEN 'Fall' THEN 1 ELSE 2 END ASC
`;

export async function getTeamSeasonByseason(teamID: number): Promise<TeamSeasonRow[]> {
  return cachedQuery(`getTeamSeasonByseason-${teamID}`, async () => {
    const db = await getDb();
    const result = await db
      .request()
      .input('teamID', teamID)
      .query<TeamSeasonRow>(GET_TEAM_SEASON_BY_SEASON_SQL);
    return result.recordset;
  }, [], { sql: GET_TEAM_SEASON_BY_SEASON_SQL, dependsOn: ['scores', 'schedule'] });
}

const GET_TEAM_FRANCHISE_HISTORY_SQL = `
  SELECT
    tnh.id,
    tnh.seasonID,
    tnh.teamName
  FROM teamNameHistory tnh
  JOIN seasons sn ON tnh.seasonID = sn.seasonID
  WHERE tnh.teamID = @teamID
  ORDER BY sn.year ASC, CASE sn.period WHEN 'Fall' THEN 2 ELSE 1 END ASC
`;

export async function getTeamFranchiseHistory(teamID: number): Promise<FranchiseNameEntry[]> {
  return cachedQuery(`getTeamFranchiseHistory-${teamID}`, async () => {
    const db = await getDb();
    const result = await db
      .request()
      .input('teamID', teamID)
      .query<FranchiseNameEntry>(GET_TEAM_FRANCHISE_HISTORY_SQL);
    return result.recordset;
  }, [], { stable: true, sql: GET_TEAM_FRANCHISE_HISTORY_SQL });
}

const GET_ALL_TEAMS_DIRECTORY_SQL = `
  SELECT
    t.teamID,
    t.teamName,
    t.slug,
    COUNT(DISTINCT sc.bowlerID)  AS rosterCount,
    COUNT(DISTINCT sc.seasonID)  AS seasonsActive,
    COUNT(sc.scoreID) * 3        AS totalGames,
    SUM(sc.scratchSeries)        AS totalPins,
    CAST(CASE WHEN t.teamID = 45 OR EXISTS (
      SELECT 1 FROM scores sc2
      WHERE sc2.teamID = t.teamID
        AND sc2.isPenalty = 0
        AND sc2.seasonID = (
          SELECT TOP 1 seasonID FROM seasons
          ORDER BY year DESC, CASE period WHEN 'Fall' THEN 2 ELSE 1 END DESC
        )
    ) THEN 1 ELSE 0 END AS BIT) AS isActive,
    (
      SELECT TOP 1 sn.displayName
      FROM teamNameHistory tnh3
      JOIN seasons sn ON tnh3.seasonID = sn.seasonID
      WHERE tnh3.teamID = t.teamID
      ORDER BY sn.year ASC, CASE sn.period WHEN 'Fall' THEN 2 ELSE 1 END ASC
    ) AS establishedSeason,
    (
      SELECT COUNT(*)
      FROM seasonChampions ch
      WHERE ch.winnerTeamID = t.teamID
        AND ch.championshipType = 'Team'
    ) AS championships
  FROM teams t
  LEFT JOIN scores sc ON sc.teamID = t.teamID AND sc.isPenalty = 0
  GROUP BY t.teamID, t.teamName, t.slug
  ORDER BY
    CASE WHEN t.teamID = 45 OR EXISTS (
      SELECT 1 FROM scores sc2
      WHERE sc2.teamID = t.teamID
        AND sc2.isPenalty = 0
        AND sc2.seasonID = (
          SELECT TOP 1 seasonID FROM seasons
          ORDER BY year DESC, CASE period WHEN 'Fall' THEN 2 ELSE 1 END DESC
        )
    ) THEN 0 ELSE 1 END,
    t.teamName ASC
`;

export const getAllTeamsDirectory = cache(async (): Promise<DirectoryTeam[]> => {
  return cachedQuery('getAllTeamsDirectory', async () => {
    const db = await getDb();
    const result = await db.request().query<DirectoryTeam>(GET_ALL_TEAMS_DIRECTORY_SQL);
    return result.recordset;
  }, [], { sql: GET_ALL_TEAMS_DIRECTORY_SQL, dependsOn: ['scores'] });
});

const GET_TEAM_SEASON_PRESENCE_SQL = `
  SELECT DISTINCT
    t.teamID,
    t.teamName,
    t.slug,
    t.chronoNumber,
    s.seasonID,
    LOWER(REPLACE(s.displayName, ' ', '-')) AS seasonSlug,
    s.romanNumeral
  FROM scores sc
  JOIN teams t ON sc.teamID = t.teamID
  JOIN seasons s ON sc.seasonID = s.seasonID
  WHERE sc.isPenalty = 0
    AND sc.teamID IS NOT NULL
  ORDER BY t.chronoNumber, s.seasonID
`;

export async function getTeamSeasonPresence(): Promise<TeamSeasonPresence[]> {
  return cachedQuery('getTeamSeasonPresence', async () => {
    const db = await getDb();
    const result = await db
      .request()
      .query<TeamSeasonPresence>(GET_TEAM_SEASON_PRESENCE_SQL);
    return result.recordset;
  }, [], { sql: GET_TEAM_SEASON_PRESENCE_SQL, dependsOn: ['scores'] });
}

const GET_TEAM_PLAYOFF_FINISHES_SQL = `
  SELECT team1ID AS teamID, seasonID, 'champion' AS finish
  FROM playoffResults
  WHERE playoffType = 'Team' AND round = 'final'
  UNION ALL
  SELECT team2ID AS teamID, seasonID, 'runner-up' AS finish
  FROM playoffResults
  WHERE playoffType = 'Team' AND round = 'final'
  UNION ALL
  SELECT team1ID AS teamID, seasonID, 'semifinalist' AS finish
  FROM playoffResults
  WHERE playoffType = 'Team' AND round = 'semifinal'
`;

export const getTeamPlayoffFinishes = cache(async (): Promise<TeamPlayoffFinish[]> => {
  return cachedQuery('getTeamPlayoffFinishes', async () => {
    const db = await getDb();
    const result = await db.request().query<TeamPlayoffFinish>(GET_TEAM_PLAYOFF_FINISHES_SQL);
    return result.recordset;
  }, [], { sql: GET_TEAM_PLAYOFF_FINISHES_SQL, stable: true });
});
