import Link from 'next/link';
import type { Metadata } from 'next';
import { getAllSeasonsDirectory } from '@/lib/queries';

export const metadata: Metadata = {
  title: 'Seasons | Splitzkrieg',
  description:
    'Browse all Splitzkrieg Bowling League seasons. Standings, stats, leaderboards, and records from 35+ seasons of bowling.',
};

export default async function SeasonsPage() {
  const seasons = await getAllSeasonsDirectory();

  // First season is the current one (newest first)
  const currentSeasonID = seasons.length > 0 ? seasons[0].seasonID : null;

  return (
    <main className="container mx-auto px-4 py-8 max-w-3xl">
      <h1 className="font-heading text-3xl sm:text-4xl text-navy mb-2">Seasons</h1>
      <p className="font-body text-navy/50 mb-8">
        {seasons.length} seasons of Splitzkrieg bowling history.
      </p>

      {seasons.length === 0 ? (
        <p className="font-body text-navy/50">No seasons found.</p>
      ) : (
        <div className="space-y-1">
          {seasons.map((season) => {
            const isCurrent = season.seasonID === currentSeasonID;
            return (
              <Link
                key={season.seasonID}
                href={`/season/${season.slug}`}
                className={`flex items-baseline justify-between gap-4 px-4 py-3 -mx-4 rounded transition-colors group ${
                  isCurrent
                    ? 'bg-red-600/[0.04] border border-red-600/10 hover:bg-red-600/[0.08]'
                    : 'hover:bg-navy/[0.03]'
                }`}
              >
                <div className="flex items-baseline gap-2 min-w-0">
                  <span className={`font-heading text-lg transition-colors whitespace-nowrap ${
                    isCurrent ? 'text-red-600' : 'text-navy group-hover:text-red-600'
                  }`}>
                    {season.period} {season.year}
                  </span>
                  <span className="font-body text-sm text-navy/40">
                    Season {season.romanNumeral}
                  </span>
                  {isCurrent && (
                    <span className="font-body text-[10px] uppercase tracking-wider text-red-600/70 bg-red-600/10 px-1.5 py-0.5 rounded font-semibold">
                      Current
                    </span>
                  )}
                </div>
                <div className="flex items-baseline gap-3 shrink-0 text-sm font-body text-navy/50">
                  <span className="tabular-nums text-left min-w-[60px]">{season.teamCount} teams</span>
                  <span className="text-navy/20">&middot;</span>
                  <span>{season.bowlerCount} bowlers</span>
                  {season.champion && (
                    <>
                      <span className="text-navy/20">&middot;</span>
                      <span className="text-navy/70">{season.champion}</span>
                    </>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <div className="mt-10 pt-6 border-t border-navy/10 flex gap-4">
        <Link
          href="/"
          className="font-body text-sm text-navy/60 hover:text-navy transition-colors"
        >
          Back to Home
        </Link>
        <Link
          href="/bowlers"
          className="font-body text-sm text-navy/60 hover:text-navy transition-colors"
        >
          Browse All Bowlers
        </Link>
      </div>
    </main>
  );
}
