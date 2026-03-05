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
        <>
          {/* Featured current season card */}
          {(() => {
            const current = seasons[0];
            return (
              <Link
                href={`/season/${current.slug}`}
                className="block mb-8 p-6 bg-navy/[0.03] border border-navy/15 rounded-xl hover:bg-navy/[0.06] hover:border-navy/25 transition-all group"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-body text-[10px] uppercase tracking-wider text-navy/70 bg-navy/10 px-1.5 py-0.5 rounded font-semibold">
                    Current Season
                  </span>
                </div>
                <h2 className="font-heading text-2xl sm:text-3xl text-navy group-hover:text-red-600 transition-colors">
                  {current.period} {current.year}
                </h2>
                <p className="font-body text-sm text-navy/50 mt-1">
                  Season {current.romanNumeral}
                </p>
                <div className="flex flex-wrap gap-4 mt-4 text-sm font-body text-navy/60">
                  <span>
                    <span className="text-navy/40">Teams </span>
                    <span className="font-semibold tabular-nums">{current.teamCount}</span>
                  </span>
                  <span>
                    <span className="text-navy/40">Bowlers </span>
                    <span className="font-semibold tabular-nums">{current.bowlerCount}</span>
                  </span>
                  {current.champion && (
                    <span>
                      <span className="text-navy/40">Champion </span>
                      <span className="font-semibold text-navy/70">{current.champion}</span>
                    </span>
                  )}
                </div>
              </Link>
            );
          })()}

          {/* Past seasons compact list */}
          {seasons.length > 1 && (
            <div className="space-y-1">
              <h2 className="font-heading text-lg text-navy/70 mb-2">Past Seasons</h2>
              {seasons.slice(1).map((season) => (
                <Link
                  key={season.seasonID}
                  href={`/season/${season.slug}`}
                  className="flex items-baseline justify-between gap-4 px-4 py-3 -mx-4 rounded transition-colors group hover:bg-navy/[0.03]"
                >
                  <div className="flex items-baseline gap-2 min-w-0">
                    <span className="font-heading text-lg transition-colors whitespace-nowrap text-navy group-hover:text-red-600">
                      {season.period} {season.year}
                    </span>
                    <span className="font-body text-sm text-navy/40">
                      Season {season.romanNumeral}
                    </span>
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
              ))}
            </div>
          )}
        </>
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
