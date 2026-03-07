import type { Metadata } from 'next';
import { getAllTeamsDirectory, getTeamSeasonPresence, getTeamPlayoffFinishes, getCurrentSeasonID } from '@/lib/queries';
import { TeamTimeline } from '@/components/team/TeamTimeline';
import { TrailNav } from '@/components/ui/TrailNav';
import { TeamsDirectory } from '@/components/team/TeamsDirectory';

export const metadata: Metadata = {
  title: 'Teams | Splitzkrieg',
  description: 'Browse all Splitzkrieg Bowling League teams -- active rosters, season history, and franchise profiles.',
};

export default async function TeamsPage() {
  const [teams, presenceData, playoffFinishes, currentSeasonID] = await Promise.all([
    getAllTeamsDirectory(),
    getTeamSeasonPresence(),
    getTeamPlayoffFinishes(),
    getCurrentSeasonID(),
  ]);

  return (
    <main className="container mx-auto px-4 py-8 max-w-5xl">
      <TrailNav current="/teams" position="top" />
      <TeamsDirectory teams={teams} />

      {presenceData.length > 0 && (
        <TeamTimeline
          presenceData={presenceData}
          playoffFinishes={playoffFinishes}
          currentSeasonID={currentSeasonID ?? undefined}
        />
      )}

      <TrailNav current="/teams" />
    </main>
  );
}
