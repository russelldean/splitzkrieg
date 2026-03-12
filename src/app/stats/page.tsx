import type { Metadata } from 'next';
import { getAllSeasonsDirectory, getCurrentSeasonSlug, getTotalPinsKnockedDown } from '@/lib/queries';
import { SeasonDirectory } from '@/components/season/SeasonDirectory';
import { ParallaxBg } from '@/components/ui/ParallaxBg';

export const metadata: Metadata = {
  title: 'Season Stats | Splitzkrieg',
  description:
    'Leaderboards, averages, and records for every Splitzkrieg Bowling League season.',
};

export default async function StatsIndexPage() {
  const [seasons, currentSlug, totalPins] = await Promise.all([
    getAllSeasonsDirectory(),
    getCurrentSeasonSlug(),
    getTotalPinsKnockedDown(),
  ]);

  return (
    <>
      <section className="relative overflow-hidden h-36 sm:h-44" role="img" aria-label="Holographic Splitzkrieg bumper sticker">
        <ParallaxBg
          src="/splitzkrieg-bumper-sticker.jpg"
          imgW={2016} imgH={1512}
          focalY={0.5}
          mobileSrc="/splitzkrieg-bumper-sticker.jpg"
          mobileFocalY={0.5}
          mobileImgW={2016} mobileImgH={1512}
        />
        <div className="absolute inset-0 bg-navy/15" />
        <div className="absolute inset-0 bg-gradient-to-r from-navy/40 via-transparent to-navy/40 sm:from-navy/70 sm:via-transparent sm:to-navy/70" />
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-end pb-6">
          <div>
            <h1 className="font-heading text-3xl sm:text-4xl text-white">Season Stats</h1>
            <p className="font-body text-white/70 text-sm mt-1">{new Intl.NumberFormat('en-US').format(totalPins)} pins across leaderboards and stat tables.</p>
          </div>
        </div>
      </section>
      <SeasonDirectory
        seasons={seasons}
        currentSlug={currentSlug ?? null}
        trailCurrent="/stats"
        heading="Season Stats"
        subheading={(count) => `Leaderboards and records for ${count} seasons.`}
        hideHeading
      />
    </>
  );
}
