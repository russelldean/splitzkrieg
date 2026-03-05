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
  { label: 'Browse Bowlers', href: '/bowlers', description: 'Every bowler since 2007' },
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
              className="h-32 sm:h-44 w-auto mix-blend-multiply"
              unoptimized
              priority
            />
            <p className="font-body text-sm sm:text-base text-navy/50 -mt-4 sm:-mt-6">
              Stats, records, and {new Date().getFullYear() - 2007} years of league history
            </p>
          </div>

          {/* This Week's Results CTA */}
          {seasonSnapshot && (
            <Link
              href={`/season/${seasonSnapshot.slug}#weekly`}
              className="block mt-6 sm:mt-8 bg-navy rounded-xl px-6 py-4 hover:bg-navy/90 transition-colors group"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-heading text-lg sm:text-xl text-white group-hover:text-red-300 transition-colors">
                    This Week&apos;s Results
                  </div>
                  <div className="font-body text-sm text-white/50 mt-0.5">
                    Season {seasonSnapshot.romanNumeral} · Week {seasonSnapshot.weekNumber}
                  </div>
                </div>
                <svg className="w-5 h-5 text-white/60 group-hover:text-white group-hover:translate-x-0.5 transition-all" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </div>
            </Link>
          )}

          {/* Explore Cards — above the fold */}
          <div className="mt-6 sm:mt-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {quickLinks.map((link, i) => (
              <Link
                key={link.href}
                href={link.href}
                className={`group bg-white rounded-xl border border-navy/10 p-4 hover:border-navy/20 hover:shadow-sm transition-all ${
                  i === quickLinks.length - 1 ? 'col-span-2 sm:col-span-1 text-center sm:text-left' : ''
                }`}
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
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-2 sm:pt-4 pb-4 sm:pb-6">
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
