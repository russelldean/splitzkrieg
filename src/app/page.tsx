import Link from 'next/link';
import Image from 'next/image';
import { getNextBowlingNight, getRecentMilestones, getCurrentSeasonSnapshot } from '@/lib/queries';
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
      {/* Milestone Ticker */}
      <MilestoneTicker milestones={milestones} />

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-navy/5 to-transparent" />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 -mt-2 sm:-mt-1 pb-3 sm:pb-4">
          <div className="flex flex-col items-center text-center">
            <Image
              src="/splitzkrieg logo.png"
              alt="Splitzkrieg Bowling League"
              width={400}
              height={144}
              className="h-32 sm:h-44 w-auto mix-blend-multiply bg-cream rounded-lg"
              priority
            />
            <p className="font-body text-sm sm:text-base text-navy/50 -mt-4 sm:-mt-6">
              Stats, records, and {new Date().getFullYear() - 2007} years of league history
            </p>
          </div>

          {/* Explore Cards — above the fold */}
          <div className="mt-6 sm:mt-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
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

      {/* Content Grid */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Countdown Clock */}
          <CountdownClock targetDate={nextBowlingNight} />

          {/* Season Snapshot */}
          <SeasonSnapshot snapshot={seasonSnapshot} />
        </div>
      </section>
    </div>
  );
}
