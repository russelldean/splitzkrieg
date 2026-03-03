import Link from 'next/link';
import { getNextBowlingNight, getRecentMilestones, getCurrentSeasonSnapshot } from '@/lib/queries';
import { DiscoverySearch } from '@/components/home/DiscoverySearch';
import { CountdownClock } from '@/components/home/CountdownClock';
import { MilestoneTicker } from '@/components/home/MilestoneTicker';
import { SeasonSnapshot } from '@/components/home/SeasonSnapshot';

export const metadata = {
  title: 'Splitzkrieg Bowling League',
  description: 'Stats, records, and history for the Splitzkrieg Bowling League. Since 2007.',
};

const quickLinks = [
  { label: 'Browse Bowlers', href: '/bowlers', description: '619 bowlers across 35+ seasons' },
  { label: 'View Teams', href: '/teams', description: 'Current and historical rosters' },
  { label: 'Seasons', href: '/seasons', description: 'Every season since 2007' },
  { label: 'Leaderboards', href: '/leaderboards', description: 'All-time records and rankings' },
  { label: 'Resources', href: '/resources', description: 'League links and forms' },
];

export default async function Home() {
  const [nextBowlingNight, milestones, seasonSnapshot] = await Promise.all([
    getNextBowlingNight(),
    getRecentMilestones(),
    getCurrentSeasonSnapshot(),
  ]);

  return (
    <div className="min-h-screen bg-cream">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Gradient background for hero area */}
        <div className="absolute inset-0 bg-gradient-to-b from-navy/5 to-transparent" />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 sm:pt-16 pb-8 sm:pb-12">
          <div className="flex flex-col items-center text-center gap-3">
            <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl text-navy uppercase tracking-widest">
              SPLITZKRIEG
            </h1>
            <p className="font-body text-base sm:text-lg text-navy/60 max-w-md">
              Stats, records, and 18 years of league history
            </p>
          </div>

          {/* Discovery Search */}
          <div className="mt-8 sm:mt-10">
            <DiscoverySearch />
          </div>
        </div>
      </section>

      {/* Milestone Ticker */}
      <MilestoneTicker milestones={milestones} />

      {/* Content Grid */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Countdown Clock */}
          <CountdownClock targetDate={nextBowlingNight} />

          {/* Season Snapshot */}
          <SeasonSnapshot snapshot={seasonSnapshot} />
        </div>

        {/* Quick Navigation */}
        <div className="mt-8 sm:mt-10">
          <h2 className="font-heading text-xl text-navy mb-4">Explore</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {quickLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="group bg-white rounded-xl border border-navy/10 p-4 hover:border-navy/20 hover:shadow-sm transition-all"
              >
                <div className="font-body text-sm font-medium text-navy group-hover:text-red transition-colors">
                  {link.label}
                </div>
                <div className="font-body text-xs text-navy/40 mt-1 leading-relaxed">
                  {link.description}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
