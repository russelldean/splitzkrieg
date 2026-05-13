/**
 * Playoff scoresheet entry page.
 * Admin enters game scores for each bowler per playoff round.
 */

import sql from 'mssql';
import { getDb } from '@/lib/db';
import {
  getDivisionTopTeams,
  getIndividualPlayoffParticipants,
} from '@/lib/admin/playoff-admin';
import {
  getPlayoffScoresForRound,
  getTeamPlayoffLineup,
  getTeamPlayoffRoster,
  type PlayoffLineupSeed,
  type TeamRosterBowler,
} from '@/lib/admin/playoff-scores-admin';
import { getRollingAverages } from '@/lib/admin/rolling-averages';
import { PlayoffScoresheetClient } from './PlayoffScoresheetClient';

export const dynamic = 'force-dynamic';

export default async function PlayoffScoresheetsPage() {
  const db = await getDb();
  const seasonResult = await db.request().query<{
    seasonID: number;
    displayName: string;
  }>(
    `SELECT TOP 1 seasonID, displayName
     FROM seasons
     ORDER BY year DESC, CASE period WHEN 'Fall' THEN 2 ELSE 1 END DESC`,
  );
  const season = seasonResult.recordset[0];

  if (!season) {
    return <div className="p-6">No current season found.</div>;
  }

  const seasonID = season.seasonID;

  const [
    topTeams,
    mScratchR1,
    wScratchR1,
    hcpR1,
    mScratchR2,
    wScratchR2,
    hcpR2,
    existingR1,
    existingR2,
  ] = await Promise.all([
    getDivisionTopTeams(seasonID),
    getIndividualPlayoffParticipants(seasonID, 'MensScratch', 1),
    getIndividualPlayoffParticipants(seasonID, 'WomensScratch', 1),
    getIndividualPlayoffParticipants(seasonID, 'Handicap', 1),
    getIndividualPlayoffParticipants(seasonID, 'MensScratch', 2),
    getIndividualPlayoffParticipants(seasonID, 'WomensScratch', 2),
    getIndividualPlayoffParticipants(seasonID, 'Handicap', 2),
    getPlayoffScoresForRound(seasonID, 1),
    getPlayoffScoresForRound(seasonID, 2),
  ]);

  const teamIDs = topTeams.map((t) => t.teamID);
  const lineupEntries = await Promise.all(
    teamIDs.flatMap((teamID) => [
      getTeamPlayoffLineup(seasonID, 1, teamID).then(
        (rows) => [1, teamID, rows] as const,
      ),
      getTeamPlayoffLineup(seasonID, 2, teamID).then(
        (rows) => [2, teamID, rows] as const,
      ),
    ]),
  );
  const teamLineups: { 1: Record<number, PlayoffLineupSeed[]>; 2: Record<number, PlayoffLineupSeed[]> } = {
    1: {},
    2: {},
  };
  for (const [round, teamID, rows] of lineupEntries) {
    teamLineups[round][teamID] = rows;
  }

  const rosterEntries = await Promise.all(
    teamIDs.flatMap((teamID) => [
      getTeamPlayoffRoster(seasonID, 1, teamID).then(
        (rows) => [1, teamID, rows] as const,
      ),
      getTeamPlayoffRoster(seasonID, 2, teamID).then(
        (rows) => [2, teamID, rows] as const,
      ),
    ]),
  );
  const teamRosters: { 1: Record<number, TeamRosterBowler[]>; 2: Record<number, TeamRosterBowler[]> } = {
    1: {},
    2: {},
  };
  for (const [round, teamID, rows] of rosterEntries) {
    teamRosters[round][teamID] = rows;
  }

  // Rolling avg lookup for each playoff week, so individual bracket entries
  // seed with the bowler's incomingAvg (which drives the Hcp column + the
  // saved incomingHcp). Without this, Handicap bracket entries would all be
  // recorded with 0 handicap.
  const maxWeekResult = await db
    .request()
    .input('seasonID', sql.Int, seasonID)
    .query<{ maxWeek: number | null }>(
      `SELECT MAX(week) AS maxWeek FROM schedule WHERE seasonID = @seasonID`,
    );
  const maxRegularWeek = maxWeekResult.recordset[0]?.maxWeek ?? 9;
  const [avgR1, avgR2] = await Promise.all([
    getRollingAverages(db, seasonID, maxRegularWeek + 1),
    getRollingAverages(db, seasonID, maxRegularWeek + 2),
  ]);

  const enrich = (avgMap: Map<number, number>) =>
    <T extends { bowlerID: number }>(p: T) => ({
      ...p,
      incomingAvg: avgMap.get(p.bowlerID) ?? null,
    });

  return (
    <PlayoffScoresheetClient
      seasonID={seasonID}
      seasonName={season.displayName ?? `Season ${seasonID}`}
      topTeams={topTeams}
      individualParticipants={{
        1: {
          MensScratch: mScratchR1.map(enrich(avgR1)),
          WomensScratch: wScratchR1.map(enrich(avgR1)),
          Handicap: hcpR1.map(enrich(avgR1)),
        },
        2: {
          MensScratch: mScratchR2.map(enrich(avgR2)),
          WomensScratch: wScratchR2.map(enrich(avgR2)),
          Handicap: hcpR2.map(enrich(avgR2)),
        },
      }}
      existingScores={{ 1: existingR1, 2: existingR2 }}
      teamLineups={teamLineups}
      teamRosters={teamRosters}
    />
  );
}
