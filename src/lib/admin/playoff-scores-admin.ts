/**
 * Playoff scores admin: write functions for the playoffScores table.
 *
 * Each row represents one bowler's 3-game set for one playoff round.
 * (seasonID, bowlerID, round) is the natural key -- re-saving overwrites.
 */

import sql from 'mssql';
import { getDb } from '@/lib/db';
import type { ChampionshipType } from './playoff-admin';

export interface PlayoffScoreInput {
  bowlerID: number;
  teamID: number | null;
  championshipType: ChampionshipType | null;
  game1: number | null;
  game2: number | null;
  game3: number | null;
  incomingAvg: number | null;
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
          incomingAvg = @incomingAvg
        WHEN NOT MATCHED THEN
          INSERT (seasonID, bowlerID, round, teamID, championshipType,
                  game1, game2, game3, incomingAvg)
          VALUES (@seasonID, @bowlerID, @round, @teamID, @championshipType,
                  @game1, @game2, @game3, @incomingAvg);
      `);
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
             game1, game2, game3, incomingAvg,
             scratchSeries, incomingHcp, hcpGame1, hcpGame2, hcpGame3, handSeries
      FROM playoffScores
      WHERE seasonID = @seasonID AND round = @round
      ORDER BY championshipType, teamID, bowlerID
    `);
  return result.recordset;
}
