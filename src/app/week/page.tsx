/**
 * Weeks index page — "All Weeks" across all seasons.
 * Groups weeks by season with links to individual week pages.
 */
import Link from 'next/link';
import type { Metadata } from 'next';
import { getAllSeasonNavList, getSeasonWeekSummaries, getCurrentSeasonSlug } from '@/lib/queries';
import { TrailNav } from '@/components/ui/TrailNav';
import { BackToTop } from '@/components/ui/BackToTop';

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
    <main id="top" className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <TrailNav current="/week" seasonSlug={currentSlug} position="top" />
      <h1 className="font-heading text-3xl sm:text-4xl text-navy mb-2">League Nights</h1>
      <p className="font-body text-navy/65 mb-8">
        Every bowling night, every season.
      </p>

      {allSeasons.map((season, i) => {
        const summaries = summariesBySeasonID.get(season.seasonID) ?? [];
        const isFirst = i === 0;
        return (
          <div key={season.seasonID} className="mb-8">
            <div className={`rounded-xl border overflow-hidden ${isFirst ? 'border-navy/10 border-l-4 border-l-red-600/40 bg-white shadow-sm' : 'border-navy/8 bg-white'}`}>
              {/* Season header */}
              <div className={`px-5 py-4 ${isFirst ? '' : 'border-b border-navy/6'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-baseline gap-3">
                    {isFirst && (
                      <span className="font-body text-xs uppercase tracking-wider text-navy/70 bg-navy/10 px-1.5 py-0.5 rounded font-semibold mr-1">
                        Current
                      </span>
                    )}
                    <Link
                      href={`/season/${season.slug}`}
                      className="font-heading text-xl text-navy hover:text-red-600 transition-colors"
                    >
                      {season.displayName}
                    </Link>
                    <span className="font-body text-sm text-navy/50">
                      {season.romanNumeral}
                    </span>
                  </div>
                  <span className="font-body text-xs text-navy/45 tabular-nums">
                    {summaries.length} {summaries.length === 1 ? 'week' : 'weeks'}
                  </span>
                </div>
              </div>

              {/* Week rows */}
              {summaries.length > 0 ? (
                <div className="divide-y divide-navy/[0.04]">
                  {summaries.map((week) => {
                    const dateStr = week.matchDate
                      ? new Date(week.matchDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                      : null;
                    return (
                      <Link
                        key={week.week}
                        href={`/week/${season.slug}/${week.week}`}
                        className="flex items-center justify-between px-5 py-2.5 hover:bg-navy/[0.02] transition-colors group"
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-heading text-base text-navy group-hover:text-red-600 transition-colors">
                            Week {week.week}
                          </span>
                          {dateStr && (
                            <span className="text-xs font-body text-navy/50">{dateStr}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-xs font-body text-navy/55">
                          {week.leagueAvg != null && week.expectedAvg != null && (() => {
                            const delta = week.leagueAvg - week.expectedAvg;
                            const sign = delta >= 0 ? '+' : '';
                            const colorClass = delta >= 0 ? 'text-green-600' : 'text-red-600';
                            return (
                              <span className="hidden sm:inline">
                                <span className="text-navy/55">Avg </span>
                                <span className="tabular-nums font-semibold text-navy/70">{week.leagueAvg}</span>
                                <span className="text-navy/25"> / </span>
                                <span className="text-navy/55">Expected </span>
                                <span className="tabular-nums text-navy/55">{week.expectedAvg}</span>
                                <span className={`tabular-nums font-semibold ml-1.5 ${colorClass}`}>{sign}{delta.toFixed(1)}</span>
                              </span>
                            );
                          })()}
                          {week.botwName && (
                            <span>
                              <span className="text-navy/55 text-xs">BOTW </span>
                              <span className="font-semibold text-navy/70">{week.botwName}</span>
                              {week.botwPinsOver != null && (
                                <span className="hidden sm:inline tabular-nums text-navy/55 ml-1">+{week.botwPinsOver}</span>
                              )}
                            </span>
                          )}
                          <svg className="w-3.5 h-3.5 text-navy/25 group-hover:text-red-600 transition-colors" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                          </svg>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <p className="font-body text-sm text-navy/50 italic px-5 py-3">No weekly data available.</p>
              )}
            </div>
          </div>
        );
      })}

      <BackToTop />

      <TrailNav current="/week" seasonSlug={currentSlug} />
    </main>
  );
}
