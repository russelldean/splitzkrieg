import { Suspense } from 'react';
import type { Metadata } from 'next';
import { getAllTeamsDirectory, getTeamSeasonPresence, getTeamPlayoffFinishes, getCurrentSeasonID } from '@/lib/queries';
import { TeamTimeline } from '@/components/team/TeamTimeline';
import { TrailNav } from '@/components/ui/TrailNav';
import { TeamsDirectory } from '@/components/team/TeamsDirectory';
import { ParallaxBg } from '@/components/ui/ParallaxBg';

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
    <>
      <section className="relative overflow-hidden h-36 sm:h-44" role="img" aria-label="Splitzkrieg CRASH parade truck with bowling pins">
        <ParallaxBg
          src="/splitzkrieg-team-signs.jpg"
          imgW={2048} imgH={1536}
          focalY={0.45}
          mobileSrc="/splitzkrieg-team-signs.jpg"
          mobileFocalY={0.45}
          mobileImgW={2048} mobileImgH={1536}
        />
        <div className="absolute inset-0 z-[1] bg-navy/15" />
        <div className="absolute inset-0 z-[1] bg-gradient-to-r from-navy/40 via-transparent to-navy/40 sm:from-navy/70 sm:via-transparent sm:to-navy/70" />
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-end pb-6">
          <div>
            <h1 className="font-heading text-3xl sm:text-4xl text-white drop-shadow-lg">Teams</h1>
            <p className="font-body text-white/85 text-sm mt-1 drop-shadow">{teams.length - 1} franchises, 17 different champions.</p>
          </div>
        </div>
      </section>
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-12">
      <TrailNav current="/teams" position="top" />
    </div>
    <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-6 sm:pb-12">
      <Suspense>
        <TeamsDirectory teams={teams} />
      </Suspense>

      {presenceData.length > 0 && (
        <TeamTimeline
          presenceData={presenceData}
          playoffFinishes={playoffFinishes}
          currentSeasonID={currentSeasonID ?? undefined}
        />
      )}
    </main>
    </>
  );
}
