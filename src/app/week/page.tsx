/**
 * Weeks index page — "All Weeks" across all seasons.
 * Groups weeks by season with links to individual week pages.
 */
import Link from 'next/link';
import type { Metadata } from 'next';
import { getAllSeasonNavList, getSeasonWeekSummaries, getCurrentSeasonSlug } from '@/lib/queries';
import { TrailNav } from '@/components/ui/TrailNav';

export const metadata: Metadata = {
  title: 'All League Nights | Splitzkrieg',
  description: 'Browse every league night across all Splitzkrieg Bowling League seasons.',
};

export default async function WeeksIndexPage() {
  const [allSeasons, currentSlug] = await Promise.all([
    getAllSeasonNavList(),
    getCurrentSeasonSlug(),
  ]);

  // Fetch week summaries for all seasons
  const summariesBySeasonID = new Map<number, Awaited<ReturnType<typeof getSeasonWeekSummaries>>>();

  await Promise.all(
    allSeasons.map(async (season) => {
      const summaries = await getSeasonWeekSummaries(season.seasonID);
      summariesBySeasonID.set(season.seasonID, summaries);
    })
  );

  return (
    <main id="top" className="container mx-auto px-4 py-8 max-w-3xl">
      <TrailNav current="/week" seasonSlug={currentSlug} position="top" />
      <h1 className="font-heading text-3xl sm:text-4xl text-navy mb-2">League Nights</h1>
      <p className="font-body text-navy/50 mb-8">
        Every bowling night, every season.
      </p>

      {allSeasons.map((season) => {
        const summaries = summariesBySeasonID.get(season.seasonID) ?? [];
        return (
          <div key={season.seasonID} className="mb-8">
            <div className="flex items-baseline gap-3 mb-3">
              <Link
                href={`/season/${season.slug}`}
                className="font-heading text-xl text-navy hover:text-red-600 transition-colors"
              >
                {season.displayName}
              </Link>
              <span className="font-body text-sm text-navy/50">
                Season {season.romanNumeral}
              </span>
            </div>
            {summaries.length > 0 ? (
              <div className="space-y-0.5">
                {summaries.map((week) => {
                  const dateStr = week.matchDate
                    ? new Date(week.matchDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                    : null;
                  return (
                    <Link
                      key={week.week}
                      href={`/week/${season.slug}/${week.week}`}
                      className="flex items-center justify-between px-4 py-2 -mx-1 rounded-lg hover:bg-navy/[0.04] transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-heading text-base text-navy group-hover:text-red-600 transition-colors">
                          Week {week.week}
                        </span>
                        {dateStr && (
                          <span className="text-xs font-body text-navy/50">{dateStr}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs font-body text-navy/50">
                        {week.leagueAvg != null && week.expectedAvg != null && (() => {
                          const delta = week.leagueAvg - week.expectedAvg;
                          const sign = delta >= 0 ? '+' : '';
                          const colorClass = delta >= 0 ? 'text-green-600' : 'text-red-600';
                          return (
                            <span className="hidden sm:inline">
                              <span className="text-navy/50">Avg </span>
                              <span className="tabular-nums font-semibold text-navy/70">{week.leagueAvg}</span>
                              <span className="text-navy/30"> / </span>
                              <span className="text-navy/50">Expected </span>
                              <span className="tabular-nums text-navy/50">{week.expectedAvg}</span>
                              <span className={`tabular-nums font-semibold ml-1.5 ${colorClass}`}>{sign}{delta.toFixed(1)}</span>
                            </span>
                          );
                        })()}
                        {week.botwName && (
                          <span>
                            <span className="text-navy/50 text-[10px] sm:text-xs">BOTW </span>
                            <span className="font-semibold text-navy/70">{week.botwName}</span>
                            {week.botwPinsOver != null && (
                              <span className="hidden sm:inline tabular-nums text-navy/50 ml-1">+{week.botwPinsOver}</span>
                            )}
                          </span>
                        )}
                        <svg className="w-4 h-4 text-navy/30 group-hover:text-red-600 transition-colors" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                        </svg>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <p className="font-body text-sm text-navy/50 italic px-4">No weekly data available.</p>
            )}
          </div>
        );
      })}

      {/* Back to top */}
      <div className="mt-8 flex justify-center">
        <a
          href="#top"
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-body text-navy/50 hover:text-red-600 bg-navy/5 hover:bg-navy/10 rounded-full transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
          </svg>
          Back to top
        </a>
      </div>

      <TrailNav current="/week" seasonSlug={currentSlug} />
    </main>
  );
}
