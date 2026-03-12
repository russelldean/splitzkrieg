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
      <section className="relative overflow-hidden h-36 sm:h-44" role="img" aria-label="Party Zone neon sign at Village Lanes">
        <ParallaxBg
          src="/village-lanes-party-zone.jpg"
          imgW={1293} imgH={621}
          focalY={0.45}
          mobileSrc="/splitzkrieg-champions-trophy.jpg"
          mobileFocalY={0.35}
          mobileImgW={1536} mobileImgH={2048}
        />
        <div className="absolute inset-0 z-[1] bg-black/15 sm:bg-navy/15" />
        <div className="absolute inset-0 z-[1] bg-gradient-to-r from-black/30 via-transparent to-black/30 sm:from-navy/70 sm:via-transparent sm:to-navy/70" />
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-end pb-6">
          <div>
            <h1 className="font-heading text-3xl sm:text-4xl text-white drop-shadow-lg">Seasons</h1>
            <p className="font-body text-white/85 text-sm mt-1 drop-shadow">{seasons.length} seasons. We've almost caught the Simpsons.</p>
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
