/**
 * Playoffs admin page — manage team semifinals and individual playoff fields
 * (Men's/Women's Scratch, Handicap) for the current season.
 *
 * Round 1 only for now; Round 2 + scoresheet generation come next.
 */

import { getDb } from '@/lib/db';
import {
  getDivisionTopTeams,
  getAllSeasonTeams,
  getPlayoffSemifinals,
  getPlayoffFinal,
  getTopScratchBowlers,
  getTopHandicapBowlers,
  getIndividualPlayoffParticipants,
  getTopAdvancingFromRoundOne,
} from '@/lib/admin/playoff-admin';
import type { ChampionshipType } from '@/lib/admin/playoff-admin';
import { PlayoffsAdminClient } from './PlayoffsAdminClient';

export const dynamic = 'force-dynamic';

const CANDIDATE_LIMIT = 16; // top N to expose in the dropdowns; admin picks 8

export default async function PlayoffsPage() {
  const db = await getDb();
  const seasonResult = await db.request().query<{
    seasonID: number;
    displayName: string;
    romanNumeral: string;
  }>(
    `SELECT TOP 1 seasonID, displayName, romanNumeral
     FROM seasons
     ORDER BY year DESC, CASE period WHEN 'Fall' THEN 2 ELSE 1 END DESC`,
  );
  const season = seasonResult.recordset[0];

  if (!season) {
    return (
      <div className="max-w-4xl mx-auto">
        <h1 className="font-heading text-2xl text-navy mb-6">Playoffs</h1>
        <p className="font-body text-sm text-navy/60">No active season.</p>
      </div>
    );
  }

  const seasonID = season.seasonID;

  // Saved selections drive handicap exclusion. Read these first so we can
  // pass the right exclusion list to getTopHandicapBowlers.
  const [savedMScratch, savedWScratch] = await Promise.all([
    getIndividualPlayoffParticipants(seasonID, 'MensScratch', 1),
    getIndividualPlayoffParticipants(seasonID, 'WomensScratch', 1),
  ]);

  const [
    divisionTopTeams,
    allTeams,
    semifinals,
    mScratchCandidates,
    wScratchCandidates,
    savedHandicap,
  ] = await Promise.all([
    getDivisionTopTeams(seasonID),
    getAllSeasonTeams(seasonID),
    getPlayoffSemifinals(seasonID),
    getTopScratchBowlers(seasonID, 'M', CANDIDATE_LIMIT),
    getTopScratchBowlers(seasonID, 'F', CANDIDATE_LIMIT),
    getIndividualPlayoffParticipants(seasonID, 'Handicap', 1),
  ]);

  // Handicap exclusion = whatever's currently saved in scratch fields.
  // If nothing saved yet, fall back to top-8 of each scratch list as a
  // best-guess so the handicap candidate list isn't polluted with scratch
  // leaders on first load.
  const exclusionIDs = new Set<number>();
  if (savedMScratch.length > 0) {
    savedMScratch.forEach(b => exclusionIDs.add(b.bowlerID));
  } else {
    mScratchCandidates.slice(0, 8).forEach(b => exclusionIDs.add(b.bowlerID));
  }
  if (savedWScratch.length > 0) {
    savedWScratch.forEach(b => exclusionIDs.add(b.bowlerID));
  } else {
    wScratchCandidates.slice(0, 8).forEach(b => exclusionIDs.add(b.bowlerID));
  }
  const handicapCandidates = await getTopHandicapBowlers(
    seasonID,
    Array.from(exclusionIDs),
    CANDIDATE_LIMIT,
  );

  // Round 2 data: team final + round 2 individual selections + advancing top 4
  const types: ChampionshipType[] = ['MensScratch', 'WomensScratch', 'Handicap'];
  const [
    teamFinal,
    round2Saved,
    round1Pool,
    advancingTopFour,
  ] = await Promise.all([
    getPlayoffFinal(seasonID),
    Promise.all(types.map(t => getIndividualPlayoffParticipants(seasonID, t, 2))),
    Promise.all(types.map(t => getIndividualPlayoffParticipants(seasonID, t, 1))),
    Promise.all(types.map(t => getTopAdvancingFromRoundOne(seasonID, t, 4))),
  ]);

  const round2Data = types.map((type, i) => ({
    type,
    saved: round2Saved[i],
    pool: round1Pool[i], // pool of 8 round 1 participants for the dropdowns
    advancing: advancingTopFour[i], // top 4 by series; empty if scores not in
  }));

  return (
    <PlayoffsAdminClient
      seasonID={seasonID}
      seasonName={season.displayName}
      divisionTopTeams={divisionTopTeams}
      allTeams={allTeams}
      semifinals={semifinals}
      mScratch={{
        candidates: mScratchCandidates,
        saved: savedMScratch,
      }}
      wScratch={{
        candidates: wScratchCandidates,
        saved: savedWScratch,
      }}
      handicap={{
        candidates: handicapCandidates,
        saved: savedHandicap,
      }}
      teamFinal={teamFinal}
      round2={{
        mScratch: round2Data[0],
        wScratch: round2Data[1],
        handicap: round2Data[2],
      }}
    />
  );
}
