/**
 * Playoff scores admin: write functions for the playoffScores table.
 *
 * Each row represents one bowler's 3-game set for one playoff round.
 * (seasonID, bowlerID, round) is the natural key -- re-saving overwrites.
 */

import fs from 'fs';
import path from 'path';
import sql from 'mssql';
import { getDb } from '@/lib/db';
import type { ChampionshipType } from './playoff-admin';
import { getRollingAverages } from './rolling-averages';
import { getLastWeekLineup } from './lineups';

export interface PlayoffScoreInput {
  bowlerID: number;
  teamID: number | null;
  championshipType: ChampionshipType | null;
  game1: number | null;
  game2: number | null;
  game3: number | null;
  incomingAvg: number | null;
  turkeys: number | null;
}

export interface PlayoffScoreRow extends PlayoffScoreInput {
  playoffScoreID: number;
  seasonID: number;
  round: 1 | 2;
  scratchSeries: number;
  incomingHcp: number;
  hcpGame1: number;
  hcpGame2: number;
  hcpGame3: number;
  handSeries: number;
}

/**
 * Upsert a batch of playoff score rows for a single (seasonID, round).
 * Re-saving any (seasonID, bowlerID, round) overwrites the prior row.
 *
 * Validation:
 * - Each row must have teamID OR championshipType set (or both); both NULL is rejected.
 * - round must be 1 or 2.
 * - championshipType must be one of the three valid values when set.
 */
export async function savePlayoffScores(
  seasonID: number,
  round: 1 | 2,
  rows: PlayoffScoreInput[],
): Promise<void> {
  if (round !== 1 && round !== 2) {
    throw new Error(`round must be 1 or 2, got ${round}`);
  }
  for (const r of rows) {
    if (r.teamID == null && r.championshipType == null) {
      throw new Error(`Row for bowlerID ${r.bowlerID} has neither teamID nor championshipType`);
    }
    if (r.championshipType != null
        && !['MensScratch', 'WomensScratch', 'Handicap'].includes(r.championshipType)) {
      throw new Error(`Invalid championshipType: ${r.championshipType}`);
    }
  }

  const pool = await getDb();
  for (const r of rows) {
    await pool.request()
      .input('seasonID', sql.Int, seasonID)
      .input('bowlerID', sql.Int, r.bowlerID)
      .input('round', sql.Int, round)
      .input('teamID', sql.Int, r.teamID)
      .input('championshipType', sql.VarChar(30), r.championshipType)
      .input('game1', sql.Int, r.game1)
      .input('game2', sql.Int, r.game2)
      .input('game3', sql.Int, r.game3)
      .input('incomingAvg', sql.Decimal(5, 1), r.incomingAvg)
      .input('turkeys', sql.Int, r.turkeys)
      .query(`
        MERGE playoffScores AS tgt
        USING (SELECT @seasonID AS seasonID, @bowlerID AS bowlerID, @round AS round) AS src
          ON tgt.seasonID = src.seasonID
             AND tgt.bowlerID = src.bowlerID
             AND tgt.round = src.round
        WHEN MATCHED THEN UPDATE SET
          teamID = @teamID,
          championshipType = @championshipType,
          game1 = @game1,
          game2 = @game2,
          game3 = @game3,
          incomingAvg = @incomingAvg,
          turkeys = @turkeys
        WHEN NOT MATCHED THEN
          INSERT (seasonID, bowlerID, round, teamID, championshipType,
                  game1, game2, game3, incomingAvg, turkeys)
          VALUES (@seasonID, @bowlerID, @round, @teamID, @championshipType,
                  @game1, @game2, @game3, @incomingAvg, @turkeys);
      `);
  }
}

export interface PlayoffLineupSeed {
  bowlerID: number;
  bowlerName: string;
  incomingAvg: number | null;
  position: number;
}

export interface TeamRosterBowler {
  bowlerID: number;
  bowlerName: string;
  incomingAvg: number | null;
}

/**
 * Returns the team's active roster for the playoff round with each bowler's
 * rolling average at the playoff week. Powers the "Add bowler" picker on the
 * scoresheet entry page — broader than the lineupSubmission seed, so admins
 * can fill in bowlers who showed up to bowl but weren't on the submitted lineup.
 */
export async function getTeamPlayoffRoster(
  seasonID: number,
  round: 1 | 2,
  teamID: number,
): Promise<TeamRosterBowler[]> {
  const db = await getDb();

  const maxWeekResult = await db
    .request()
    .input('seasonID', sql.Int, seasonID)
    .query<{ maxWeek: number | null }>(
      `SELECT MAX(week) AS maxWeek FROM schedule WHERE seasonID = @seasonID`,
    );
  const maxRegularWeek = maxWeekResult.recordset[0]?.maxWeek ?? 9;
  const playoffWeek = maxRegularWeek + round;
  const rollingAvgMap = await getRollingAverages(db, seasonID, playoffWeek);

  // Active roster = any bowler who recorded a non-penalty score for this team
  // in the current or prior season.
  const rosterResult = await db
    .request()
    .input('teamID', sql.Int, teamID)
    .input('seasonID', sql.Int, seasonID)
    .query<{ bowlerID: number; bowlerName: string }>(
      `SELECT DISTINCT s.bowlerID, b.bowlerName
       FROM scores s
       JOIN bowlers b ON b.bowlerID = s.bowlerID
       WHERE s.teamID = @teamID
         AND s.seasonID IN (@seasonID, @seasonID - 1)
         AND s.isPenalty = 0
         AND b.bowlerName <> 'Penalty'
       ORDER BY b.bowlerName`,
    );

  return rosterResult.recordset.map((r) => ({
    bowlerID: r.bowlerID,
    bowlerName: r.bowlerName,
    incomingAvg: rollingAvgMap.get(r.bowlerID) ?? null,
  }));
}

/**
 * Return the lineup that should bowl for a team in a playoff round. Reads the
 * lineupSubmissions row for the team's playoff week (regular maxWeek + round),
 * falls back to the team's most recent prior submission. Each entry comes with
 * the bowler's rolling average as of the playoff week.
 *
 * Skips lineup entries without a real bowlerID (new-bowler-name slots can't
 * be seeded — admin would have to add them manually after the bowler exists).
 */
export async function getTeamPlayoffLineup(
  seasonID: number,
  round: 1 | 2,
  teamID: number,
): Promise<PlayoffLineupSeed[]> {
  const db = await getDb();

  const maxWeekResult = await db
    .request()
    .input('seasonID', sql.Int, seasonID)
    .query<{ maxWeek: number | null }>(
      `SELECT MAX(week) AS maxWeek FROM schedule WHERE seasonID = @seasonID`,
    );
  const maxRegularWeek = maxWeekResult.recordset[0]?.maxWeek ?? 9;
  const playoffWeek = maxRegularWeek + round;

  const rollingAvgMap = await getRollingAverages(db, seasonID, playoffWeek);

  const lineupResult = await db
    .request()
    .input('seasonID', sql.Int, seasonID)
    .input('week', sql.Int, playoffWeek)
    .input('teamID', sql.Int, teamID)
    .query<{
      bowlerID: number | null;
      bowlerName: string | null;
      position: number;
    }>(
      `SELECT le.bowlerID, b.bowlerName, le.position
       FROM lineupSubmissions ls
       JOIN lineupEntries le ON ls.id = le.submissionID
       LEFT JOIN bowlers b ON le.bowlerID = b.bowlerID
       WHERE ls.seasonID = @seasonID AND ls.week = @week AND ls.teamID = @teamID
       ORDER BY le.position`,
    );

  let entries: Array<{ bowlerID: number | null; bowlerName: string | null; position: number }>
    = lineupResult.recordset;

  if (entries.length === 0) {
    const prior = await getLastWeekLineup(teamID, seasonID, playoffWeek - 1);
    entries = prior.map((e) => ({
      bowlerID: e.bowlerID,
      bowlerName: e.bowlerName ?? null,
      position: e.position,
    }));
  }

  return entries
    .filter((e): e is typeof e & { bowlerID: number } => e.bowlerID != null)
    .map((e) => ({
      bowlerID: e.bowlerID,
      bowlerName: e.bowlerName ?? `Bowler ${e.bowlerID}`,
      incomingAvg: rollingAvgMap.get(e.bowlerID) ?? null,
      position: e.position,
    }));
}

/**
 * Bump the playoffScores cache channel for a season so cachedQuery reads pick
 * up the latest. Idempotent and resilient to read-only Vercel filesystems
 * (in which case the bust happens via the next published-week deploy).
 */
export function bumpPlayoffScoresVersion(seasonID: number): void {
  const projectRoot = process.cwd();
  const versionsPath = path.join(projectRoot, '.data-versions.json');

  let versions: Record<string, Record<string, number>> = {};
  try {
    versions = JSON.parse(fs.readFileSync(versionsPath, 'utf-8'));
  } catch {
    // file doesn't exist yet
  }

  if (!versions.playoffScores) versions.playoffScores = {};
  const key = String(seasonID);
  versions.playoffScores[key] = (versions.playoffScores[key] || 1) + 1;

  try {
    fs.writeFileSync(versionsPath, JSON.stringify(versions, null, 2) + '\n');
  } catch {
    // read-only on Vercel; cache busts on next deploy
  }
}

/**
 * Read all rows for a season/round (admin view). Used to prefill the entry form.
 */
export async function getPlayoffScoresForRound(
  seasonID: number,
  round: 1 | 2,
): Promise<PlayoffScoreRow[]> {
  const pool = await getDb();
  const result = await pool.request()
    .input('seasonID', sql.Int, seasonID)
    .input('round', sql.Int, round)
    .query<PlayoffScoreRow>(`
      SELECT playoffScoreID, seasonID, bowlerID, round, teamID, championshipType,
             game1, game2, game3, incomingAvg, turkeys,
             scratchSeries, incomingHcp, hcpGame1, hcpGame2, hcpGame3, handSeries
      FROM playoffScores
      WHERE seasonID = @seasonID AND round = @round
      ORDER BY championshipType, teamID, bowlerID
    `);
  return result.recordset;
}
