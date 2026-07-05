/**
 * Team page view-model: one batched per-team read + pure assembly.
 * Mirrors src/lib/views/bowler-page.ts. Consolidates 8 per-team SELECTs (7 reused
 * verbatim + one all-seasons-bowlers query that replaces the per-season N+1) into
 * one mssql request (result.recordsets[0..7]).
 */
import { cache } from 'react';
import { getDb, cachedQuery } from '../db';
import { GET_TEAM_CURRENT_ROSTER_SQL, GET_TEAM_ALL_TIME_ROSTER_SQL } from '../queries/teams/roster';
import { GET_TEAM_SEASON_BY_SEASON_SQL, GET_TEAM_FRANCHISE_HISTORY_SQL } from '../queries/teams/history';
import { GET_TEAM_H2H_SQL, GET_TEAM_PLAYOFF_H2H_SQL } from '../queries/teams/h2h';
import { GET_TEAM_CURRENT_STANDING_SQL } from '../queries/teams/profile';
import type { TeamRosterMember, TeamSeasonBowler, AllTimeRosterMember } from '../queries/teams/roster';
import type { TeamSeasonRow, FranchiseNameEntry } from '../queries/teams/history';
import type { TeamCurrentStanding } from '../queries/teams/profile';
import type { TeamH2HMatchup, PlayoffH2HMatchup } from '../queries/teams/h2h';

export interface TeamPageView {
  currentRoster: TeamRosterMember[];
  teamSeasons: TeamSeasonRow[];
  allTimeRoster: AllTimeRosterMember[];
  franchiseHistory: FranchiseNameEntry[];
  currentStanding: TeamCurrentStanding | null;
  h2hMatchups: TeamH2HMatchup[];
  playoffH2H: PlayoffH2HMatchup[];
  bowlersBySeason: Record<number, TeamSeasonBowler[]>;
}

type AllSeasonBowlerRow = TeamSeasonBowler & { seasonID: number };

/** Bucket all-season bowler rows by seasonID (rows arrive pre-ordered within season). */
export function groupBowlersBySeason(rows: AllSeasonBowlerRow[]): Record<number, TeamSeasonBowler[]> {
  const out: Record<number, TeamSeasonBowler[]> = {};
  for (const r of rows) {
    const { seasonID, ...bowler } = r;
    (out[seasonID] ??= []).push(bowler);
  }
  return out;
}

/**
 * Assemble the flat DTO from the 8 recordsets, in this fixed order:
 * 0 currentRoster, 1 teamSeasons, 2 allTimeRoster, 3 franchiseHistory,
 * 4 currentStanding, 5 h2h, 6 playoffH2H, 7 allSeasonBowlers.
 */
export function assembleTeamView(recordsets: unknown[][]): TeamPageView {
  return {
    currentRoster: (recordsets[0] ?? []) as TeamRosterMember[],
    teamSeasons: (recordsets[1] ?? []) as TeamSeasonRow[],
    allTimeRoster: (recordsets[2] ?? []) as AllTimeRosterMember[],
    franchiseHistory: (recordsets[3] ?? []) as FranchiseNameEntry[],
    currentStanding: ((recordsets[4] ?? [])[0] as TeamCurrentStanding) ?? null,
    h2hMatchups: (recordsets[5] ?? []) as TeamH2HMatchup[],
    playoffH2H: (recordsets[6] ?? []) as PlayoffH2HMatchup[],
    bowlersBySeason: groupBowlersBySeason((recordsets[7] ?? []) as AllSeasonBowlerRow[]),
  };
}

/** All-seasons bowler rows for the team (replaces the per-season N+1). Statement 8. */
const GET_TEAM_ALL_SEASON_BOWLERS_SQL = `
  SELECT
    sc.seasonID,
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
    AND sc.isPenalty = 0
  GROUP BY sc.seasonID, b.bowlerID, b.bowlerName, b.slug
  ORDER BY sc.seasonID, gamesBowled DESC, average DESC
`;

/**
 * Batched per-team SQL. Order MUST match assembleTeamView's recordset order:
 * 0 currentRoster, 1 teamSeasons, 2 allTimeRoster, 3 franchiseHistory,
 * 4 currentStanding, 5 h2h, 6 playoffH2H, 7 allSeasonBowlers.
 * The first 7 are reused verbatim from the query modules - do NOT edit them here.
 */
export const TEAM_VIEW_BATCH_SQL = [
  GET_TEAM_CURRENT_ROSTER_SQL,
  GET_TEAM_SEASON_BY_SEASON_SQL,
  GET_TEAM_ALL_TIME_ROSTER_SQL,
  GET_TEAM_FRANCHISE_HISTORY_SQL,
  GET_TEAM_CURRENT_STANDING_SQL,
  GET_TEAM_H2H_SQL,
  GET_TEAM_PLAYOFF_H2H_SQL,
  GET_TEAM_ALL_SEASON_BOWLERS_SQL,
].join(';\n');

const EMPTY_VIEW: TeamPageView = {
  currentRoster: [],
  teamSeasons: [],
  allTimeRoster: [],
  franchiseHistory: [],
  currentStanding: null,
  h2hMatchups: [],
  playoffH2H: [],
  bowlersBySeason: {},
};

/**
 * One round-trip for the whole team page (was ~11 + one per season). No per-team
 * data-version channel exists, so invalidate on the union of channels the folded
 * queries read: scores, schedule, bowlers. This also gives franchiseHistory +
 * playoffH2H real invalidation (they were stable:true on mutable tables).
 */
export const getTeamPageView = cache(async (teamID: number): Promise<TeamPageView> => {
  return cachedQuery(
    `getTeamPageView-${teamID}`,
    async () => {
      const db = await getDb();
      const result = await db.request().input('teamID', teamID).query(TEAM_VIEW_BATCH_SQL);
      return assembleTeamView(result.recordsets as unknown[][]);
    },
    EMPTY_VIEW,
    { sql: TEAM_VIEW_BATCH_SQL, dependsOn: ['scores', 'schedule', 'bowlers'] },
  );
});
