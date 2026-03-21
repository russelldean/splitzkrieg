/**
 * All-Time Stats hub page.
 * Directory linking to all-time leaderboards, records, and deep cuts.
 */
import Link from 'next/link';
import type { Metadata } from 'next';
import { TrailNav } from '@/components/ui/TrailNav';
import { SectionHeading } from '@/components/ui/SectionHeading';

export const metadata: Metadata = {
  title: 'All-Time Stats | Splitzkrieg',
  description:
    'All-time leaderboards, records, and championship history across 35+ seasons of Splitzkrieg Bowling League.',
};

function DirectoryItem({ href, title, description }: { href: string; title: string; description: string }) {
  return (
    <div>
      <h3 className="font-heading text-lg text-navy">{title}</h3>
      <p className="font-body text-sm text-navy/65 mt-1">{description}</p>
      <Link
        href={href}
        className="inline-block mt-2 text-sm text-red-600 hover:text-red-700 font-body"
      >
        View {title} &rarr;
      </Link>
    </div>
  );
}

export default function AllTimeStatsPage() {
  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-12">
      <TrailNav current="/stats" position="top" />
      <div className="flex items-center gap-2 text-sm font-body text-navy/65 mb-4">
        <Link href="/stats" className="hover:text-red-600 transition-colors">Stats</Link>
        <span className="text-navy/60">/</span>
        <span className="text-navy/70">All-Time</span>
      </div>

      <h1 className="font-heading text-3xl md:text-4xl lg:text-5xl text-navy">
        All-Time Stats
      </h1>
      <p className="font-body text-lg text-navy/60 mt-1">
        35+ seasons of Splitzkrieg bowling history
      </p>

      {/* Leaderboards & Championships */}
      <div className="mt-10">
        <SectionHeading>Leaderboards &amp; Championships</SectionHeading>
        <div className="space-y-6">
          <DirectoryItem
            href="/stats/all-time/career-leaderboard"
            title="Career Leaderboard"
            description="All-time career stats for every bowler in league history"
          />
          <DirectoryItem
            href="/stats/all-time/team-championships"
            title="Team Championships"
            description="Playoff and championship history across all seasons"
          />
          <DirectoryItem
            href="/stats/all-time/individual-champions"
            title="Individual Champions"
            description="Scratch and handicap champions across all seasons"
          />
        </div>
      </div>

      {/* Deep Cuts */}
      <div className="mt-10">
        <SectionHeading>Deep Cuts</SectionHeading>
        <p className="font-body text-sm text-navy/65 -mt-2 mb-6">
          Statistical one-offs and record progressions
        </p>
        <div className="space-y-6">
          <DirectoryItem
            href="/stats/all-time/high-game-record"
            title="High Game Record"
            description="How the all-time high scratch game record has progressed across seasons"
          />
          <DirectoryItem
            href="/stats/all-time/game-profiles"
            title="League Night Profiles"
            description="Are you a Fast Starter, Middle Child, Late Bloomer, or Flatliner?"
          />
        </div>
      </div>

      <TrailNav current="/stats" />
    </main>
  );
}
