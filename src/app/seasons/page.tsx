import Link from 'next/link';
import type { Metadata } from 'next';
import { getAllSeasonsDirectory } from '@/lib/queries';
import { strikeX } from '@/components/ui/StrikeX';

export const metadata: Metadata = {
  title: 'Seasons | Splitzkrieg',
  description:
    'Browse all Splitzkrieg Bowling League seasons. Standings, stats, leaderboards, and records from 35+ seasons of bowling.',
};

export default async function SeasonsPage() {
  const seasons = await getAllSeasonsDirectory();

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
          {seasons.map((season) => (
            <Link
              key={season.seasonID}
              href={`/season/${season.slug}`}
              className="flex items-baseline justify-between gap-4 px-4 py-3 -mx-4 rounded hover:bg-navy/[0.03] transition-colors group"
            >
              <div className="flex items-baseline gap-2 min-w-0">
                <span className="font-heading text-lg text-navy group-hover:text-red-600 transition-colors whitespace-nowrap">
                  {season.period} {season.year}
                </span>
                <span className="font-body text-sm text-navy/40">
                  Season {strikeX(season.romanNumeral)}
                </span>
              </div>
              <div className="flex items-baseline gap-3 shrink-0 text-sm font-body text-navy/50">
                <span>{season.teamCount} teams</span>
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
