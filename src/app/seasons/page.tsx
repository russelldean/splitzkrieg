import type { Metadata } from 'next';
import { getAllSeasonsDirectory, getCurrentSeasonSlug } from '@/lib/queries';
import { SeasonDirectory } from '@/components/season/SeasonDirectory';
import { ParallaxBg } from '@/components/ui/ParallaxBg';

export const metadata: Metadata = {
  title: 'Seasons | Splitzkrieg',
  description:
    'Browse all Splitzkrieg Bowling League seasons. Standings, stats, leaderboards, and records from 35+ seasons of bowling.',
};

export default async function SeasonsPage() {
  const [seasons, currentSlug] = await Promise.all([
    getAllSeasonsDirectory(),
    getCurrentSeasonSlug(),
  ]);

  return (
    <>
      <section className="relative overflow-hidden h-36 sm:h-44" role="img" aria-label="CRT bowling scoreboard at Village Lanes">
        <ParallaxBg
          src="/splitzkrieg-scoreboards.jpg"
          imgW={1512} imgH={604}
          focalY={0.5}
          mobileSrc="/splitzkrieg-scoreboards.jpg"
          mobileFocalY={0.5}
          mobileImgW={1512} mobileImgH={604}
        />
        <div className="absolute inset-0 bg-navy/15" />
        <div className="absolute inset-0 bg-gradient-to-r from-navy/70 via-transparent to-navy/70" />
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-end pb-6">
          <div>
            <h1 className="font-heading text-3xl sm:text-4xl text-white">Seasons</h1>
            <p className="font-body text-white/70 text-sm mt-1">{seasons.length} seasons of Splitzkrieg bowling</p>
          </div>
        </div>
      </section>
      <SeasonDirectory
        seasons={seasons}
        currentSlug={currentSlug ?? null}
        trailCurrent="/seasons"
        heading="Seasons"
        subheading={(count) => `${count} seasons of Splitzkrieg bowling history.`}
        hideHeading
      />
    </>
  );
}
