/**
 * Playoff scoresheet entry page.
 * Admin enters game scores for each bowler per playoff round.
 */

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { getDb } from '@/lib/db';
import {
  getDivisionTopTeams,
  getIndividualPlayoffParticipants,
} from '@/lib/admin/playoff-admin';
import { getPlayoffScoresForRound } from '@/lib/admin/playoff-scores-admin';
import { PlayoffScoresheetClient } from './PlayoffScoresheetClient';

export const dynamic = 'force-dynamic';

export default async function PlayoffScoresheetsPage() {
  const cookieStore = await cookies();
  if (!cookieStore.get('admin_session')) redirect('/evillair/login');

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

  return (
    <PlayoffScoresheetClient
      seasonID={seasonID}
      seasonName={season.displayName ?? `Season ${seasonID}`}
      topTeams={topTeams}
      individualParticipants={{
        1: { MensScratch: mScratchR1, WomensScratch: wScratchR1, Handicap: hcpR1 },
        2: { MensScratch: mScratchR2, WomensScratch: wScratchR2, Handicap: hcpR2 },
      }}
      existingScores={{ 1: existingR1, 2: existingR2 }}
    />
  );
}
