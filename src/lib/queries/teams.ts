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

export async function getTeamCurrentStanding(teamID: number): Promise<TeamCurrentStanding | null> {
  return cachedQuery(`getTeamCurrentStanding-${teamID}`, async () => {
    const db = await getDb();
    const result = await db
      .request()
      .input('teamID', teamID)
      .query<TeamCurrentStanding>(`
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
      `);
    return result.recordset[0] ?? null;
  }, null);
}

export async function getAllTeamSlugs(): Promise<TeamSlug[]> {
  return cachedQuery('getAllTeamSlugs', async () => {
    const db = await getDb();
    const result = await db.request().query<TeamSlug>(`
      SELECT slug FROM teams WHERE slug IS NOT NULL ORDER BY teamName
    `);
    return result.recordset;
  }, [], { stable: true });
}

export const getTeamBySlug = cache(async (slug: string): Promise<Team | null> => {
  return cachedQuery(`getTeamBySlug-${slug}`, async () => {
    const db = await getDb();
    const result = await db
      .request()
      .input('slug', slug)
      .query<Team>(`
        SELECT t.teamID, t.teamName, t.slug,
               t.captainBowlerID,
               b.bowlerName AS captainName,
               b.slug AS captainSlug
        FROM teams t
        LEFT JOIN bowlers b ON t.captainBowlerID = b.bowlerID
        WHERE t.slug = @slug
      `);
    return result.recordset[0] ?? null;
  }, null, { stable: true });
});

export async function getTeamCurrentRoster(teamID: number): Promise<TeamRosterMember[]> {
  return cachedQuery(`getTeamCurrentRoster-${teamID}`, async () => {
    const db = await getDb();
    const result = await db
      .request()
      .input('teamID', teamID)
      .query<TeamRosterMember>(`
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
      `);
    return result.recordset;
  }, []);
}

export async function getTeamSeasonByseason(teamID: number): Promise<TeamSeasonRow[]> {
  return cachedQuery(`getTeamSeasonByseason-${teamID}`, async () => {
    const db = await getDb();
    const result = await db
      .request()
      .input('teamID', teamID)
      .query<TeamSeasonRow>(`
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
      `);
    return result.recordset;
  }, []);
}

export async function getTeamSeasonBowlers(teamID: number, seasonID: number): Promise<TeamSeasonBowler[]> {
  return cachedQuery(`getTeamSeasonBowlers-${teamID}-${seasonID}`, async () => {
    const db = await getDb();
    const result = await db
      .request()
      .input('teamID', teamID)
      .input('seasonID', seasonID)
      .query<TeamSeasonBowler>(`
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
      `);
    return result.recordset;
  }, []);
}

export async function getTeamAllTimeRoster(teamID: number): Promise<AllTimeRosterMember[]> {
  return cachedQuery(`getTeamAllTimeRoster-${teamID}`, async () => {
    const db = await getDb();
    const result = await db
      .request()
      .input('teamID', teamID)
      .query<AllTimeRosterMember>(`
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
      `);
    return result.recordset;
  }, []);
}

export async function getTeamFranchiseHistory(teamID: number): Promise<FranchiseNameEntry[]> {
  return cachedQuery(`getTeamFranchiseHistory-${teamID}`, async () => {
    const db = await getDb();
    const result = await db
      .request()
      .input('teamID', teamID)
      .query<FranchiseNameEntry>(`
        SELECT
          tnh.id,
          tnh.seasonID,
          tnh.teamName
        FROM teamNameHistory tnh
        JOIN seasons sn ON tnh.seasonID = sn.seasonID
        WHERE tnh.teamID = @teamID
        ORDER BY sn.year ASC, CASE sn.period WHEN 'Fall' THEN 2 ELSE 1 END ASC
      `);
    return result.recordset;
  }, [], { stable: true });
}

export const getAllTeamsDirectory = cache(async (): Promise<DirectoryTeam[]> => {
  return cachedQuery('getAllTeamsDirectory', async () => {
    const db = await getDb();
    const result = await db.request().query<DirectoryTeam>(`
      SELECT
        t.teamID,
        t.teamName,
        t.slug,
        COUNT(DISTINCT sc.bowlerID)  AS rosterCount,
        COUNT(DISTINCT sc.seasonID)  AS seasonsActive,
        COUNT(sc.scoreID) * 3        AS totalGames,
        SUM(sc.scratchSeries)        AS totalPins,
        CAST(CASE WHEN EXISTS (
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
        CASE WHEN EXISTS (
          SELECT 1 FROM scores sc2
          WHERE sc2.teamID = t.teamID
            AND sc2.isPenalty = 0
            AND sc2.seasonID = (
              SELECT TOP 1 seasonID FROM seasons
              ORDER BY year DESC, CASE period WHEN 'Fall' THEN 2 ELSE 1 END DESC
            )
        ) THEN 0 ELSE 1 END,
        t.teamName ASC
    `);
    return result.recordset;
  }, []);
});

export interface TeamSeasonPresence {
  teamID: number;
  teamName: string;
  slug: string;
  seasonID: number;
  seasonSlug: string;
  romanNumeral: string;
}

export async function getTeamSeasonPresence(): Promise<TeamSeasonPresence[]> {
  return cachedQuery('getTeamSeasonPresence', async () => {
    const db = await getDb();
    const result = await db
      .request()
      .query<TeamSeasonPresence>(`
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
      `);
    return result.recordset;
  }, [], { stable: true });
}

export interface TeamPlayoffFinish {
  teamID: number;
  seasonID: number;
  finish: 'champion' | 'runner-up' | 'semifinalist';
}

export const getTeamPlayoffFinishes = cache(async (): Promise<TeamPlayoffFinish[]> => {
  return cachedQuery('getTeamPlayoffFinishes', async () => {
    const db = await getDb();
    const result = await db.request().query<TeamPlayoffFinish>(`
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
    `);
    return result.recordset;
  }, [], { stable: true });
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
  ourGamePts: number;
  theirGamePts: number;
  ourSeries: number | null;
  theirSeries: number | null;
}

export interface TeamH2HActiveTeam {
  teamID: number;
  teamName: string;
  slug: string;
}

export async function getTeamH2H(teamID: number): Promise<TeamH2HMatchup[]> {
  return cachedQuery(`getTeamH2H-${teamID}`, async () => {
    const db = await getDb();
    const result = await db
      .request()
      .input('teamID', teamID)
      .query<TeamH2HMatchup>(`
        WITH matchups AS (
          SELECT
            sch.team2ID AS opponentID,
            sch.seasonID,
            sch.week,
            sch.matchDate,
            mr.team1GamePts AS ourGamePts,
            mr.team2GamePts AS theirGamePts,
            mr.team1Series AS ourSeries,
            mr.team2Series AS theirSeries
          FROM matchResults mr
          JOIN schedule sch ON mr.scheduleID = sch.scheduleID
          WHERE sch.team1ID = @teamID
          UNION ALL
          SELECT
            sch.team1ID AS opponentID,
            sch.seasonID,
            sch.week,
            sch.matchDate,
            mr.team2GamePts AS ourGamePts,
            mr.team1GamePts AS theirGamePts,
            mr.team2Series AS ourSeries,
            mr.team1Series AS theirSeries
          FROM matchResults mr
          JOIN schedule sch ON mr.scheduleID = sch.scheduleID
          WHERE sch.team2ID = @teamID
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
          m.ourGamePts,
          m.theirGamePts,
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
      `);
    return result.recordset;
  }, []);
}

export async function getActiveTeamIDs(): Promise<TeamH2HActiveTeam[]> {
  return cachedQuery('getActiveTeamIDs', async () => {
    const db = await getDb();
    const result = await db.request().query<TeamH2HActiveTeam>(`
      SELECT DISTINCT t.teamID, t.teamName, t.slug
      FROM teams t
      JOIN scores sc ON sc.teamID = t.teamID AND sc.isPenalty = 0
      WHERE sc.seasonID = (
        SELECT TOP 1 seasonID FROM seasons
        ORDER BY year DESC, CASE period WHEN 'Fall' THEN 2 ELSE 1 END DESC
      )
      ORDER BY t.teamName
    `);
    return result.recordset;
  }, [], { stable: true });
}
