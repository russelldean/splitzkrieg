/**
 * Team page view-model: one batched per-team read + pure assembly.
 * Mirrors src/lib/views/bowler-page.ts. Consolidates 8 per-team SELECTs (7 reused
 * verbatim + one all-seasons-bowlers query that replaces the per-season N+1) into
 * one mssql request (result.recordsets[0..7]).
 */
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
