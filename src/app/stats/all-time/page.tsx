/**
 * All-Time Stats page.
 * Shows team and individual championship history across all seasons.
 */
import Link from 'next/link';
import type { Metadata } from 'next';
import {
  getAllPlayoffHistory,
  getAllIndividualChampions,
  getAllTimeLeaderboard,
} from '@/lib/queries';
import { TrailNav } from '@/components/ui/TrailNav';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { AllTimeLeaderboardTable } from '@/components/alltime/AllTimeLeaderboardTable';
import { PlayoffHistoryTable } from '@/components/alltime/PlayoffHistoryTable';
import { IndividualChampionsTable } from '@/components/alltime/IndividualChampionsTable';

export const metadata: Metadata = {
  title: 'All-Time Stats | Splitzkrieg',
  description:
    'All-time leaderboards, records, and championship history across 35+ seasons of Splitzkrieg Bowling League.',
};

export default async function AllTimeStatsPage() {
  const [playoffs, individualChampions, leaderboard] = await Promise.all([
    getAllPlayoffHistory(),
    getAllIndividualChampions(),
    getAllTimeLeaderboard(),
  ]);

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-12">
      <TrailNav current="/stats" position="top" />
      <div className="flex items-center gap-2 text-sm font-body text-navy/65 mb-4">
        <Link
          href="/stats"
          className="hover:text-red-600 transition-colors"
        >
          Stats
        </Link>
        <span className="text-navy/30">/</span>
        <span className="text-navy/70">All-Time</span>
      </div>

      <h1 className="font-heading text-3xl md:text-4xl lg:text-5xl text-navy">
        All-Time Stats
      </h1>
      <p className="font-body text-lg text-navy/60 mt-1">
        35+ seasons of Splitzkrieg bowling history
      </p>

      {/* All-Time Leaderboard */}
      <details className="mt-10 group">
        <summary className="cursor-pointer list-none">
          <SectionHeading>
            <span className="inline-flex items-center gap-2">
              Career Leaderboard
              <span className="text-navy/30 text-sm font-body font-normal group-open:rotate-90 transition-transform">&#9654;</span>
            </span>
          </SectionHeading>
        </summary>
        <div className="mt-4">
          <AllTimeLeaderboardTable data={leaderboard} />
        </div>
      </details>

      {/* Team Championship History */}
      <details className="mt-10 group">
        <summary className="cursor-pointer list-none">
          <SectionHeading>
            <span className="inline-flex items-center gap-2">
              Team Championships
              <span className="text-navy/30 text-sm font-body font-normal group-open:rotate-90 transition-transform">&#9654;</span>
            </span>
          </SectionHeading>
        </summary>
        <div className="mt-4">
          <PlayoffHistoryTable playoffs={playoffs} />
        </div>

        {playoffs.length === 0 && (
          <p className="font-body text-navy/65 italic mt-4">
            No playoff data available.
          </p>
        )}
      </details>

      {/* Individual Championship History */}
      <details className="mt-10 group">
        <summary className="cursor-pointer list-none">
          <SectionHeading>
            <span className="inline-flex items-center gap-2">
              Individual Champions
              <span className="text-navy/30 text-sm font-body font-normal group-open:rotate-90 transition-transform">&#9654;</span>
            </span>
          </SectionHeading>
        </summary>
        <div className="mt-4">
          <IndividualChampionsTable champions={individualChampions} />
        </div>

        {individualChampions.length === 0 && (
          <p className="font-body text-navy/65 italic mt-4">
            No individual championship data available.
          </p>
        )}
      </details>

      <TrailNav current="/stats" />
    </main>
  );
}
