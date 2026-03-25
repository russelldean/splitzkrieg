/**
 * Team Championships page.
 * Playoff and championship history for all teams.
 */
import Link from 'next/link';
import type { Metadata } from 'next';
import { getAllPlayoffHistory } from '@/lib/queries';
import { PlayoffHistoryTable } from '@/components/alltime/PlayoffHistoryTable';

export const metadata: Metadata = {
  title: 'Team Championships | Splitzkrieg',
  description:
    'Team championship and playoff history across 35+ seasons of Splitzkrieg Bowling League.',
};

export default async function TeamChampionshipsPage() {
  const playoffs = await getAllPlayoffHistory();

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-12">
      <div className="flex items-center gap-2 text-sm font-body text-navy/65 mb-4">
        <Link href="/stats" className="hover:text-red-600 transition-colors">Stats</Link>
        <span className="text-navy/60">/</span>
        <Link href="/stats/all-time" className="hover:text-red-600 transition-colors">All-Time</Link>
        <span className="text-navy/60">/</span>
        <span className="text-navy/70">Team Championships</span>
      </div>

      <h1 className="font-heading text-3xl md:text-4xl lg:text-5xl text-navy">
        Team Championships
      </h1>
      <p className="font-body text-lg text-navy/60 mt-1">
        Playoff and championship history across all seasons
      </p>

      <div className="mt-8">
        <PlayoffHistoryTable playoffs={playoffs} />
      </div>

      {playoffs.length === 0 && (
        <p className="font-body text-navy/65 italic mt-4">
          No playoff data available.
        </p>
      )}

    </main>
  );
}
