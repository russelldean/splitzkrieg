/**
 * Public playoff-week page queries.
 *
 * Drives /playoffs/[seasonSlug]/[round]: team matches (semis/final) + the three
 * individual bracket leaderboards. All reads from playoffScores; depends on
 * the playoffScores cache channel so they invalidate when scores are saved.
 */
import sql from 'mssql';
import { cachedQuery, getDb } from '@/lib/db';

export interface PlayoffPageBowler {
  teamID: number;
  bowlerID: number;
  bowlerName: string;
  slug: string;
  game1: number | null;
  game2: number | null;
  game3: number | null;
  incomingAvg: number | null;
  incomingHcp: number;
  turkeys: number | null;
  scratchSeries: number;
  handSeries: number;
}

export interface PlayoffTeamMatch {
  playoffID: number;
  team1ID: number;
  team2ID: number;
  team1Name: string;
  team2Name: string;
  team1Slug: string;
  team2Slug: string;
  winnerTeamID: number | null;
  bowlers: PlayoffPageBowler[];
}

const TEAM_MATCHES_SQL = `
  SELECT pr.playoffID, pr.team1ID, pr.team2ID, pr.winnerTeamID,
         t1.teamName AS team1Name, t1.slug AS team1Slug,
         t2.teamName AS team2Name, t2.slug AS team2Slug
  FROM playoffResults pr
  JOIN teams t1 ON pr.team1ID = t1.teamID
  JOIN teams t2 ON pr.team2ID = t2.teamID
  WHERE pr.seasonID = @seasonID
    AND pr.playoffType = 'Team'
    AND pr.round = @roundLabel
  ORDER BY pr.playoffID
`;

const TEAM_BOWLERS_SQL = `
  SELECT ps.teamID, ps.bowlerID, b.bowlerName, b.slug,
         ps.game1, ps.game2, ps.game3, ps.incomingAvg, ps.incomingHcp, ps.turkeys,
         ps.scratchSeries, ps.handSeries
  FROM playoffScores ps
  JOIN bowlers b ON b.bowlerID = ps.bowlerID
  WHERE ps.seasonID = @seasonID
    AND ps.round = @round
    AND ps.teamID IS NOT NULL
  ORDER BY ps.teamID, ps.playoffScoreID
`;

/**
 * Returns team semifinal/final matches for one playoff round, each with both
 * teams' bowler-level playoff scores.
 */
export async function getPlayoffTeamMatches(
  seasonID: number,
  round: 1 | 2,
): Promise<PlayoffTeamMatch[]> {
  return cachedQuery(
    `getPlayoffTeamMatches-${seasonID}-${round}`,
    async () => {
      const pool = await getDb();
      const roundLabel = round === 1 ? 'semifinal' : 'final';

      const matchesResult = await pool
        .request()
        .input('seasonID', sql.Int, seasonID)
        .input('roundLabel', sql.VarChar(20), roundLabel)
        .query<{
          playoffID: number;
          team1ID: number;
          team2ID: number;
          winnerTeamID: number | null;
          team1Name: string;
          team2Name: string;
          team1Slug: string;
          team2Slug: string;
        }>(TEAM_MATCHES_SQL);

      const bowlersResult = await pool
        .request()
        .input('seasonID', sql.Int, seasonID)
        .input('round', sql.Int, round)
        .query<PlayoffPageBowler>(TEAM_BOWLERS_SQL);

      const bowlersByTeam = new Map<number, PlayoffPageBowler[]>();
      for (const b of bowlersResult.recordset) {
        const arr = bowlersByTeam.get(b.teamID) ?? [];
        arr.push(b);
        bowlersByTeam.set(b.teamID, arr);
      }

      return matchesResult.recordset.map((m) => ({
        ...m,
        bowlers: [
          ...(bowlersByTeam.get(m.team1ID) ?? []),
          ...(bowlersByTeam.get(m.team2ID) ?? []),
        ],
      }));
    },
    [],
    {
      sql: TEAM_MATCHES_SQL + TEAM_BOWLERS_SQL,
      dependsOn: ['playoffScores'],
      seasonID,
    },
  );
}

/**
 * Returns [seasonID, round] pairs where ANY playoff setup exists for that
 * round — team matchups in playoffResults, individual qualifiers in
 * individualPlayoffParticipants, or actual scores in playoffScores. Used by
 * generateStaticParams so the page renders as soon as the admin sets up the
 * round (matchups visible as "upcoming") and re-renders once scores land.
 */
const SEASONS_WITH_PLAYOFF_SETUP_SQL = `
  SELECT DISTINCT seasonID, round_num AS round FROM (
    SELECT seasonID,
           CASE round WHEN 'semifinal' THEN 1 WHEN 'final' THEN 2 ELSE NULL END AS round_num
    FROM playoffResults
    WHERE playoffType = 'Team'
    UNION ALL
    SELECT seasonID, round AS round_num FROM individualPlayoffParticipants
    UNION ALL
    SELECT seasonID, round AS round_num FROM playoffScores
  ) src
  WHERE round_num IS NOT NULL
  ORDER BY seasonID, round_num
`;

export async function getSeasonsWithPlayoffData(): Promise<
  Array<{ seasonID: number; round: number }>
> {
  return cachedQuery(
    `getSeasonsWithPlayoffData`,
    async () => {
      const pool = await getDb();
      const result = await pool.request().query<{
        seasonID: number;
        round: number;
      }>(SEASONS_WITH_PLAYOFF_SETUP_SQL);
      return result.recordset;
    },
    [],
    {
      sql: SEASONS_WITH_PLAYOFF_SETUP_SQL,
      dependsOn: ['playoffScores'],
    },
  );
}

export interface PlayoffBracketParticipant {
  bowlerID: number;
  bowlerName: string;
  slug: string;
  position: number;
}

const BRACKET_PARTICIPANTS_SQL = `
  SELECT ipp.bowlerID, b.bowlerName, b.slug, ipp.position
  FROM individualPlayoffParticipants ipp
  JOIN bowlers b ON b.bowlerID = ipp.bowlerID
  WHERE ipp.seasonID = @seasonID
    AND ipp.championshipType = @championshipType
    AND ipp.round = @round
  ORDER BY ipp.position
`;

/**
 * Returns the saved qualifier list for one bracket/round. Used as the
 * "upcoming" view before scores have been entered.
 */
export async function getPlayoffBracketParticipants(
  seasonID: number,
  championshipType: 'MensScratch' | 'WomensScratch' | 'Handicap',
  round: 1 | 2,
): Promise<PlayoffBracketParticipant[]> {
  return cachedQuery(
    `getPlayoffBracketParticipants-${seasonID}-${championshipType}-${round}`,
    async () => {
      const pool = await getDb();
      const result = await pool
        .request()
        .input('seasonID', sql.Int, seasonID)
        .input('championshipType', sql.VarChar(30), championshipType)
        .input('round', sql.Int, round)
        .query<PlayoffBracketParticipant>(BRACKET_PARTICIPANTS_SQL);
      return result.recordset;
    },
    [],
    {
      sql: BRACKET_PARTICIPANTS_SQL,
      dependsOn: ['playoffScores'],
      seasonID,
    },
  );
}
