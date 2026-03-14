/**
 * Weeks index page — "All Weeks" across all seasons.
 * Groups weeks by season with links to individual week pages.
 */
import type { Metadata } from 'next';
import { getAllSeasonNavList, getSeasonWeekSummaries, getCurrentSeasonSnapshot, getDataCompleteness } from '@/lib/queries';
import { TrailNav } from '@/components/ui/TrailNav';
import { BackToTop } from '@/components/ui/BackToTop';
import { ParallaxBg } from '@/components/ui/ParallaxBg';
import { SeasonAccordion } from '@/components/week/SeasonAccordion';

export const metadata: Metadata = {
  title: 'All League Nights | Splitzkrieg',
  description: 'Browse every league night across all Splitzkrieg Bowling League seasons.',
};

export default async function WeeksIndexPage() {
  const [allSeasons, snapshot, completeness] = await Promise.all([
    getAllSeasonNavList(),
    getCurrentSeasonSnapshot(),
    getDataCompleteness(),
  ]);
  const currentSlug = snapshot?.slug;

  // Fetch week summaries — batch to avoid overwhelming Azure SQL (30 conn limit)
  const summariesBySeasonID = new Map<number, Awaited<ReturnType<typeof getSeasonWeekSummaries>>>();
  const BATCH_SIZE = 8;

  for (let i = 0; i < allSeasons.length; i += BATCH_SIZE) {
    const batch = allSeasons.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (season) => {
        const summaries = await getSeasonWeekSummaries(season.seasonID);
        summariesBySeasonID.set(season.seasonID, summaries);
      })
    );
  }

  const totalNights = completeness.totalNights;

  return (
    <>
      <section className="relative overflow-hidden h-36 sm:h-44" role="img" aria-label="Bowling balls and shoes on retro red chairs">
        <ParallaxBg
          src="/splitzkrieg-balls-shoes.jpg"
          imgW={1440} imgH={1440}
          focalY={0.5}
          mobileSrc="/splitzkrieg-balls-shoes.jpg"
          mobileFocalY={0.5}
          mobileImgW={1440} mobileImgH={1440}
        />
        <div className="absolute inset-0 z-[1] bg-navy/15" />
        <div className="absolute inset-0 z-[1] bg-gradient-to-r from-navy/40 via-transparent to-navy/40 sm:from-navy/70 sm:via-transparent sm:to-navy/70" />
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-end pb-6">
          <div>
            <h1 className="font-heading text-3xl sm:text-4xl text-white drop-shadow-lg">League Nights</h1>
            <p className="font-body text-white/85 text-sm mt-1 drop-shadow">{totalNights} bowling nights and counting.</p>
          </div>
        </div>
      </section>
    <main id="top" className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-12">
      <TrailNav current="/week" position="top" />

      <SeasonAccordion
        seasons={allSeasons.map((season) => ({
          seasonID: season.seasonID,
          slug: season.slug,
          displayName: season.displayName,
          romanNumeral: season.romanNumeral,
          summaries: summariesBySeasonID.get(season.seasonID) ?? [],
        }))}
        currentSlug={currentSlug}
        latestWeek={snapshot?.weekNumber ?? null}
      />

      <BackToTop />

      <TrailNav current="/week" />
    </main>
    </>
  );
}
