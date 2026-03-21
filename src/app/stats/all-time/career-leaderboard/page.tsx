/**
 * Career Leaderboard page.
 * All-time career stats for every bowler in league history.
 */
import Link from 'next/link';
import type { Metadata } from 'next';
import { getAllTimeLeaderboard } from '@/lib/queries';
import { TrailNav } from '@/components/ui/TrailNav';
import { AllTimeLeaderboardTable } from '@/components/alltime/AllTimeLeaderboardTable';

export const metadata: Metadata = {
  title: 'Career Leaderboard | Splitzkrieg',
  description:
    'All-time career leaderboard across 35+ seasons of Splitzkrieg Bowling League.',
};

export default async function CareerLeaderboardPage() {
  const leaderboard = await getAllTimeLeaderboard();

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-12">
      <TrailNav current="/stats" position="top" />
      <div className="flex items-center gap-2 text-sm font-body text-navy/65 mb-4">
        <Link href="/stats" className="hover:text-red-600 transition-colors">Stats</Link>
        <span className="text-navy/60">/</span>
        <Link href="/stats/all-time" className="hover:text-red-600 transition-colors">All-Time</Link>
        <span className="text-navy/60">/</span>
        <span className="text-navy/70">Career Leaderboard</span>
      </div>

      <h1 className="font-heading text-3xl md:text-4xl lg:text-5xl text-navy">
        Career Leaderboard
      </h1>
      <p className="font-body text-lg text-navy/60 mt-1">
        All-time career stats across 35+ seasons
      </p>

      <div className="mt-8">
        <AllTimeLeaderboardTable data={leaderboard} />
      </div>

      <TrailNav current="/stats" />
    </main>
  );
}
