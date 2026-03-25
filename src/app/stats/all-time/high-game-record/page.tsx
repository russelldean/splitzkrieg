/**
 * High Game Record Progression page.
 * Shows how the all-time high scratch game record has progressed across seasons.
 */
import Link from 'next/link';
import type { Metadata } from 'next';
import { getHighGameProgression } from '@/lib/queries/alltime';
import { HighGameProgression } from '@/components/alltime/HighGameProgression';

export const metadata: Metadata = {
  title: 'High Game Record | Splitzkrieg',
  description:
    'How the all-time high scratch game record has progressed across 35+ seasons of Splitzkrieg Bowling League.',
};

export default async function HighGameRecordPage() {
  const { records, latestNight } = await getHighGameProgression();

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-12">
      <div className="flex items-center gap-2 text-sm font-body text-navy/65 mb-4">
        <Link href="/stats" className="hover:text-red-600 transition-colors">Stats</Link>
        <span className="text-navy/60">/</span>
        <Link href="/stats/all-time" className="hover:text-red-600 transition-colors">All-Time</Link>
        <span className="text-navy/60">/</span>
        <span className="text-navy/70">High Game Record</span>
      </div>

      <h1 className="font-heading text-3xl md:text-4xl lg:text-5xl text-navy">
        High Game Record
      </h1>
      <p className="font-body text-lg text-navy/60 mt-1">
        How the all-time high scratch game record has progressed across seasons
      </p>

      <div className="mt-8">
        <HighGameProgression records={records} latestNight={latestNight} />
      </div>

    </main>
  );
}
