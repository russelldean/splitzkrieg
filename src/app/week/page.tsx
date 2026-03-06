/**
 * Weeks index page — "All Weeks" across all seasons.
 * Groups weeks by season with links to individual week pages.
 */
import Link from 'next/link';
import type { Metadata } from 'next';
import { getAllSeasonNavList, getSeasonWeekSummaries } from '@/lib/queries';

export const metadata: Metadata = {
  title: 'All League Nights | Splitzkrieg',
  description: 'Browse every league night across all Splitzkrieg Bowling League seasons.',
};

export default async function WeeksIndexPage() {
  const allSeasons = await getAllSeasonNavList();

  // Fetch week summaries for the 5 most recent seasons
  const recentSeasons = allSeasons.slice(0, 5);
  const summariesBySeasonID = new Map<number, Awaited<ReturnType<typeof getSeasonWeekSummaries>>>();

  await Promise.all(
    recentSeasons.map(async (season) => {
      const summaries = await getSeasonWeekSummaries(season.seasonID);
      summariesBySeasonID.set(season.seasonID, summaries);
    })
  );

  return (
    <main className="container mx-auto px-4 py-8 max-w-3xl">
      <h1 className="font-heading text-3xl sm:text-4xl text-navy mb-2">League Nights</h1>
      <p className="font-body text-navy/50 mb-8">
        Every bowling night, every season.
      </p>

      {recentSeasons.map((season) => {
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
              <span className="font-body text-sm text-navy/40">
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
                          <span className="text-xs font-body text-navy/40">{dateStr}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs font-body text-navy/50">
                        {week.highGame && (
                          <span className="hidden sm:inline">
                            <span className="text-navy/40">High Game </span>
                            <span className="tabular-nums font-semibold text-navy/70">{week.highGame}</span>
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
              <p className="font-body text-sm text-navy/40 italic px-4">No weekly data available.</p>
            )}
          </div>
        );
      })}

      {allSeasons.length > 5 && (
        <div className="border-t border-navy/10 pt-6">
          <h2 className="font-heading text-lg text-navy/70 mb-3">Older Seasons</h2>
          <div className="space-y-1">
            {allSeasons.slice(5).map((season) => (
              <Link
                key={season.seasonID}
                href={`/season/${season.slug}#weekly`}
                className="flex items-baseline justify-between px-4 py-2 -mx-1 rounded-lg hover:bg-navy/[0.04] transition-colors group"
              >
                <span className="font-heading text-base text-navy group-hover:text-red-600 transition-colors">
                  {season.displayName}
                </span>
                <span className="font-body text-xs text-navy/40">Season {season.romanNumeral}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
