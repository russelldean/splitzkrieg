import { cachedQuery, getDb } from '@/lib/db';
import sql from 'mssql';
import type { ChampionshipType } from '@/lib/admin/playoff-admin';

export interface PlayoffScoresheetEntry {
  bowlerID: number;
  bowlerName: string;
  slug: string;
  teamID: number | null;
  championshipType: ChampionshipType | null;
  game1: number | null;
  game2: number | null;
  game3: number | null;
  incomingAvg: number | null;
  scratchSeries: number;
  handSeries: number;
  isAlternate: boolean;
}

const TEAM_SCORESHEET_SQL = `
  SELECT ps.bowlerID, b.bowlerName, b.slug,
         ps.teamID, ps.championshipType,
         ps.game1, ps.game2, ps.game3, ps.incomingAvg,
         ps.scratchSeries, ps.handSeries,
         CAST(0 AS BIT) AS isAlternate
  FROM playoffScores ps
  JOIN bowlers b ON b.bowlerID = ps.bowlerID
  WHERE ps.seasonID = @seasonID AND ps.round = @round AND ps.teamID = @teamID
  ORDER BY ps.playoffScoreID
`;

/**
 * Returns the lineup that bowled for one team in one playoff round.
 * Used to render a team scoresheet on the future public recap page.
 */
export async function getTeamPlayoffScoresheet(
  seasonID: number,
  round: 1 | 2,
  teamID: number,
): Promise<PlayoffScoresheetEntry[]> {
  return cachedQuery(
    `getTeamPlayoffScoresheet-${seasonID}-${round}-${teamID}`,
    async () => {
      const pool = await getDb();
      const result = await pool.request()
        .input('seasonID', sql.Int, seasonID)
        .input('round', sql.Int, round)
        .input('teamID', sql.Int, teamID)
        .query<PlayoffScoresheetEntry>(TEAM_SCORESHEET_SQL);
      return result.recordset;
    },
    [],
    { sql: TEAM_SCORESHEET_SQL, dependsOn: ['playoffScores'], seasonID },
  );
}

const INDIVIDUAL_BRACKET_SQL = `
  SELECT ps.bowlerID, b.bowlerName, b.slug,
         ps.teamID, ps.championshipType,
         ps.game1, ps.game2, ps.game3, ps.incomingAvg,
         ps.scratchSeries, ps.handSeries,
         CASE WHEN ipp.bowlerID IS NULL THEN CAST(1 AS BIT) ELSE CAST(0 AS BIT) END AS isAlternate
  FROM playoffScores ps
  JOIN bowlers b ON b.bowlerID = ps.bowlerID
  LEFT JOIN individualPlayoffParticipants ipp
    ON ipp.seasonID = ps.seasonID
       AND ipp.bowlerID = ps.bowlerID
       AND ipp.championshipType = ps.championshipType
       AND ipp.round = ps.round
  WHERE ps.seasonID = @seasonID
    AND ps.round = @round
    AND ps.championshipType = @championshipType
  ORDER BY
    CASE WHEN ps.championshipType = 'Handicap' THEN ps.handSeries ELSE ps.scratchSeries END DESC
`;

/**
 * Returns the leaderboard for one individual bracket round, ordered by the
 * relevant series (handSeries for Handicap, scratchSeries otherwise). Bowlers
 * not in individualPlayoffParticipants for this season+type+round are flagged
 * as alternates.
 */
export async function getIndividualBracketResults(
  seasonID: number,
  championshipType: ChampionshipType,
  round: 1 | 2,
): Promise<PlayoffScoresheetEntry[]> {
  return cachedQuery(
    `getIndividualBracketResults-${seasonID}-${championshipType}-${round}`,
    async () => {
      const pool = await getDb();
      const result = await pool.request()
        .input('seasonID', sql.Int, seasonID)
        .input('round', sql.Int, round)
        .input('championshipType', sql.VarChar(30), championshipType)
        .query<PlayoffScoresheetEntry>(INDIVIDUAL_BRACKET_SQL);
      return result.recordset;
    },
    [],
    { sql: INDIVIDUAL_BRACKET_SQL, dependsOn: ['playoffScores'], seasonID },
  );
}
