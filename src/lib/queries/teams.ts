/**
 * Team-related SQL queries.
 * Includes team profile, roster, season history, directory, and timeline.
 */
import { cache } from 'react';
import { getDb, cachedQuery } from '../db';

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

export interface TeamRosterMember {
  bowlerID: number;
  bowlerName: string;
  slug: string;
  gamesBowled: number;
  seasonAverage: number | null;
  firstSeason: string | null;
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
  isChampion: boolean;
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
  }, null, { sql: GET_TEAM_CURRENT_STANDING_SQL });
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
  }, [], { sql: GET_TEAM_CURRENT_ROSTER_SQL });
}

const GET_TEAM_SEASON_BY_SEASON_SQL = `
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
    ) THEN 1 ELSE 0 END AS BIT)                       AS isChampion
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
`;

export async function getTeamSeasonByseason(teamID: number): Promise<TeamSeasonRow[]> {
  return cachedQuery(`getTeamSeasonByseason-${teamID}`, async () => {
    const db = await getDb();
    const result = await db
      .request()
      .input('teamID', teamID)
      .query<TeamSeasonRow>(GET_TEAM_SEASON_BY_SEASON_SQL);
    return result.recordset;
  }, [], { sql: GET_TEAM_SEASON_BY_SEASON_SQL });
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
  }, [], { sql: GET_TEAM_ALL_TIME_ROSTER_SQL });
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
  }, [], { sql: GET_ALL_TEAMS_DIRECTORY_SQL });
});

export interface TeamSeasonPresence {
  teamID: number;
  teamName: string;
  slug: string;
  seasonID: number;
  seasonSlug: string;
  romanNumeral: string;
}

const GET_TEAM_SEASON_PRESENCE_SQL = `
  SELECT DISTINCT
    t.teamID,
    t.teamName,
    t.slug,
    s.seasonID,
    LOWER(REPLACE(s.displayName, ' ', '-')) AS seasonSlug,
    s.romanNumeral
  FROM scores sc
  JOIN teams t ON sc.teamID = t.teamID
  JOIN seasons s ON sc.seasonID = s.seasonID
  WHERE sc.isPenalty = 0
    AND sc.teamID IS NOT NULL
  ORDER BY t.teamName, s.seasonID
`;

export async function getTeamSeasonPresence(): Promise<TeamSeasonPresence[]> {
  return cachedQuery('getTeamSeasonPresence', async () => {
    const db = await getDb();
    const result = await db
      .request()
      .query<TeamSeasonPresence>(GET_TEAM_SEASON_PRESENCE_SQL);
    return result.recordset;
  }, [], { stable: true, sql: GET_TEAM_SEASON_PRESENCE_SQL });
}

export interface TeamPlayoffFinish {
  teamID: number;
  seasonID: number;
  finish: 'champion' | 'runner-up' | 'semifinalist';
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
  }, [], { stable: true, sql: GET_TEAM_PLAYOFF_FINISHES_SQL });
});

// ── Head-to-Head ──────────────────────────────────────────────

export interface TeamH2HMatchup {
  opponentID: number;
  opponentName: string;
  opponentSlug: string;
  seasonID: number;
  seasonName: string;
  seasonSlug: string;
  week: number;
  matchDate: string | null;
  ourGame1: number | null;
  ourGame2: number | null;
  ourGame3: number | null;
  theirGame1: number | null;
  theirGame2: number | null;
  theirGame3: number | null;
  ourSeries: number | null;
  theirSeries: number | null;
}

export interface TeamH2HActiveTeam {
  teamID: number;
  teamName: string;
  slug: string;
}

const GET_TEAM_H2H_SQL = `
  WITH matchups AS (
    SELECT
      sch.team2ID AS opponentID,
      sch.seasonID,
      sch.week,
      sch.matchDate,
      mr.team1Game1 AS ourGame1,
      mr.team1Game2 AS ourGame2,
      mr.team1Game3 AS ourGame3,
      mr.team2Game1 AS theirGame1,
      mr.team2Game2 AS theirGame2,
      mr.team2Game3 AS theirGame3,
      mr.team1Series AS ourSeries,
      mr.team2Series AS theirSeries
    FROM matchResults mr
    JOIN schedule sch ON mr.scheduleID = sch.scheduleID
    WHERE sch.team1ID = @teamID AND sch.team2ID != 45
    UNION ALL
    SELECT
      sch.team1ID AS opponentID,
      sch.seasonID,
      sch.week,
      sch.matchDate,
      mr.team2Game1 AS ourGame1,
      mr.team2Game2 AS ourGame2,
      mr.team2Game3 AS ourGame3,
      mr.team1Game1 AS theirGame1,
      mr.team1Game2 AS theirGame2,
      mr.team1Game3 AS theirGame3,
      mr.team2Series AS ourSeries,
      mr.team1Series AS theirSeries
    FROM matchResults mr
    JOIN schedule sch ON mr.scheduleID = sch.scheduleID
    WHERE sch.team2ID = @teamID AND sch.team1ID != 45
  )
  SELECT
    m.opponentID,
    COALESCE(tnh_latest.teamName, t.teamName) AS opponentName,
    t.slug AS opponentSlug,
    m.seasonID,
    sn.displayName AS seasonName,
    LOWER(REPLACE(sn.displayName, ' ', '-')) AS seasonSlug,
    m.week,
    m.matchDate,
    m.ourGame1,
    m.ourGame2,
    m.ourGame3,
    m.theirGame1,
    m.theirGame2,
    m.theirGame3,
    m.ourSeries,
    m.theirSeries
  FROM matchups m
  JOIN teams t ON m.opponentID = t.teamID
  JOIN seasons sn ON m.seasonID = sn.seasonID
  OUTER APPLY (
    SELECT TOP 1 tnh.teamName
    FROM teamNameHistory tnh
    JOIN seasons sn2 ON tnh.seasonID = sn2.seasonID
    WHERE tnh.teamID = m.opponentID
    ORDER BY sn2.year DESC, CASE sn2.period WHEN 'Fall' THEN 2 ELSE 1 END DESC
  ) tnh_latest
  ORDER BY sn.year DESC, CASE sn.period WHEN 'Fall' THEN 2 ELSE 1 END DESC, m.week DESC
`;

export async function getTeamH2H(teamID: number): Promise<TeamH2HMatchup[]> {
  return cachedQuery(`getTeamH2H-${teamID}`, async () => {
    const db = await getDb();
    const result = await db
      .request()
      .input('teamID', teamID)
      .query<TeamH2HMatchup>(GET_TEAM_H2H_SQL);
    return result.recordset;
  }, [], { sql: GET_TEAM_H2H_SQL });
}

// ── Ghost Team H2H ──────────────────────────────────────────

export interface GhostTeamMatchup {
  opponentID: number;
  opponentName: string;
  opponentSlug: string;
  seasonID: number;
  seasonName: string;
  seasonSlug: string;
  week: number;
  matchDate: string | null;
  teamAvg: number;
  scratchGame1: number;
  scratchGame2: number;
  scratchGame3: number;
  scratchSeries: number;
}

const GET_GHOST_TEAM_H2H_SQL = `
  WITH ghostMatches AS (
    SELECT
      sch.scheduleID,
      sch.seasonID,
      sch.week,
      sch.matchDate,
      CASE WHEN sch.team1ID = 45 THEN sch.team2ID ELSE sch.team1ID END AS opponentID
    FROM schedule sch
    WHERE (sch.team1ID = 45 OR sch.team2ID = 45)
      AND sch.team1ID IS NOT NULL AND sch.team2ID IS NOT NULL
  ),
  oppScores AS (
    SELECT
      gm.scheduleID,
      gm.seasonID,
      gm.week,
      gm.matchDate,
      gm.opponentID,
      SUM(sc.game1) AS scratchGame1,
      SUM(sc.game2) AS scratchGame2,
      SUM(sc.game3) AS scratchGame3,
      SUM(sc.scratchSeries) AS scratchSeries,
      SUM(CAST(sc.incomingAvg AS INT)) AS teamAvg
    FROM ghostMatches gm
    JOIN scores sc ON sc.seasonID = gm.seasonID
      AND sc.week = gm.week
      AND sc.teamID = gm.opponentID
      AND sc.isPenalty = 0
    GROUP BY gm.scheduleID, gm.seasonID, gm.week, gm.matchDate, gm.opponentID
    HAVING SUM(sc.incomingAvg) IS NOT NULL
  )
  SELECT
    os.opponentID,
    COALESCE(tnh_latest.teamName, t.teamName) AS opponentName,
    t.slug AS opponentSlug,
    os.seasonID,
    sn.displayName AS seasonName,
    LOWER(REPLACE(sn.displayName, ' ', '-')) AS seasonSlug,
    os.week,
    os.matchDate,
    os.teamAvg,
    os.scratchGame1,
    os.scratchGame2,
    os.scratchGame3,
    os.scratchSeries
  FROM oppScores os
  JOIN teams t ON os.opponentID = t.teamID
  JOIN seasons sn ON os.seasonID = sn.seasonID
  OUTER APPLY (
    SELECT TOP 1 tnh.teamName
    FROM teamNameHistory tnh
    JOIN seasons sn2 ON tnh.seasonID = sn2.seasonID
    WHERE tnh.teamID = os.opponentID
    ORDER BY sn2.year DESC, CASE sn2.period WHEN 'Fall' THEN 2 ELSE 1 END DESC
  ) tnh_latest
  ORDER BY sn.year DESC, CASE sn.period WHEN 'Fall' THEN 2 ELSE 1 END DESC, os.week DESC
`;

export async function getGhostTeamH2H(): Promise<GhostTeamMatchup[]> {
  return cachedQuery('getGhostTeamH2H', async () => {
    const db = await getDb();
    const result = await db
      .request()
      .query<GhostTeamMatchup>(GET_GHOST_TEAM_H2H_SQL);
    return result.recordset;
  }, [], { sql: GET_GHOST_TEAM_H2H_SQL });
}

const GET_ACTIVE_TEAM_IDS_SQL = `
  SELECT DISTINCT t.teamID, t.teamName, t.slug
  FROM teams t
  JOIN scores sc ON sc.teamID = t.teamID AND sc.isPenalty = 0
  WHERE sc.seasonID = (
    SELECT TOP 1 seasonID FROM seasons
    ORDER BY year DESC, CASE period WHEN 'Fall' THEN 2 ELSE 1 END DESC
  )
  ORDER BY t.teamName
`;

export async function getActiveTeamIDs(): Promise<TeamH2HActiveTeam[]> {
  return cachedQuery('getActiveTeamIDs', async () => {
    const db = await getDb();
    const result = await db.request().query<TeamH2HActiveTeam>(GET_ACTIVE_TEAM_IDS_SQL);
    return result.recordset;
  }, [], { stable: true, sql: GET_ACTIVE_TEAM_IDS_SQL });
}

// ── Pairwise H2H Summary ────────────────────────────────────

export interface PairH2HSummary {
  team1ID: number;
  team2ID: number;
  wins: number;    // team1 game wins
  losses: number;  // team1 game losses
  ties: number;
}

/**
 * For a list of team-pair tuples, return their all-time H2H game record.
 * Used on week preview pages to show the matchup history.
 */
export async function getPairwiseH2H(
  pairs: { team1ID: number; team2ID: number }[]
): Promise<PairH2HSummary[]> {
  if (pairs.length === 0) return [];
  const pairKey = (a: number, b: number) => a < b ? `${a}-${b}` : `${b}-${a}`;
  const seen = new Set<string>();
  const uniquePairs: { a: number; b: number }[] = [];
  for (const { team1ID, team2ID } of pairs) {
    const k = pairKey(team1ID, team2ID);
    if (!seen.has(k)) {
      seen.add(k);
      uniquePairs.push({ a: Math.min(team1ID, team2ID), b: Math.max(team1ID, team2ID) });
    }
  }

  const cacheKey = `getPairwiseH2H-${uniquePairs.map(p => `${p.a}_${p.b}`).join(',')}`;

  const PAIRWISE_H2H_SQL_TEMPLATE = `
    SELECT
      sch.team1ID,
      sch.team2ID,
      mr.team1Game1 AS t1g1, mr.team1Game2 AS t1g2, mr.team1Game3 AS t1g3,
      mr.team2Game1 AS t2g1, mr.team2Game2 AS t2g2, mr.team2Game3 AS t2g3
    FROM matchResults mr
    JOIN schedule sch ON mr.scheduleID = sch.scheduleID
  `;

  return cachedQuery(cacheKey, async () => {
    const db = await getDb();

    interface RawRow {
      team1ID: number;
      team2ID: number;
      t1g1: number | null; t1g2: number | null; t1g3: number | null;
      t2g1: number | null; t2g2: number | null; t2g3: number | null;
    }

    const conditions = uniquePairs.map((p, i) =>
      `(sch.team1ID = @a${i} AND sch.team2ID = @b${i}) OR (sch.team1ID = @b${i} AND sch.team2ID = @a${i})`
    ).join(' OR ');

    const request = db.request();
    for (let i = 0; i < uniquePairs.length; i++) {
      request.input(`a${i}`, uniquePairs[i].a);
      request.input(`b${i}`, uniquePairs[i].b);
    }

    const sql = `${PAIRWISE_H2H_SQL_TEMPLATE} WHERE ${conditions}`;
    const result = await request.query<RawRow>(sql);

    // Accumulate W/L/T from perspective of first team in each requested pair
    const map = new Map<string, PairH2HSummary>();
    for (const { team1ID, team2ID } of pairs) {
      const k = pairKey(team1ID, team2ID);
      if (!map.has(k)) {
        map.set(k, { team1ID, team2ID, wins: 0, losses: 0, ties: 0 });
      }
    }

    for (const row of result.recordset) {
      const games: [number | null, number | null][] = [
        [row.t1g1, row.t2g1],
        [row.t1g2, row.t2g2],
        [row.t1g3, row.t2g3],
      ];
      for (const [g1, g2] of games) {
        if (g1 == null || g2 == null) continue;
        const k = pairKey(row.team1ID, row.team2ID);
        const summary = map.get(k);
        if (!summary) continue;

        const sameOrder = summary.team1ID === row.team1ID;
        const t1Score = sameOrder ? g1 : g2;
        const t2Score = sameOrder ? g2 : g1;

        if (t1Score > t2Score) summary.wins++;
        else if (t1Score < t2Score) summary.losses++;
        else summary.ties++;
      }
    }

    return Array.from(map.values());
  }, [], { sql: PAIRWISE_H2H_SQL_TEMPLATE });
}
