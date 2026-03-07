import Link from 'next/link';
import Image from 'next/image';
import {
  getRecentMilestones,
  getCurrentSeasonSnapshot,
  getNextBowlingNight,
  getSeasonBySlug,
  getSeasonStandings,
  getSeasonSchedule,
  getSeasonMatchResults,
} from '@/lib/queries';
import { MilestoneTicker } from '@/components/home/MilestoneTicker';
import { SeasonSnapshot } from '@/components/home/SeasonSnapshot';
import { MiniStandings } from '@/components/home/MiniStandings';
import { ThisWeekMatchups } from '@/components/home/ThisWeekMatchups';
import { HeaderCountdown } from '@/components/layout/HeaderCountdown';

export const metadata = {
  title: 'Splitzkrieg Bowling League',
  description: 'Stats, records, and history for the Splitzkrieg Bowling League. Since 2007.',
};

const quickLinks = [
  { label: 'League Nights', href: '/week', description: 'Weekly matchups and scores' },
  { label: 'Seasons', href: '/seasons', description: 'Every season since 2007' },
  { label: 'The Stats', href: '/stats', description: 'Leaderboards and rankings' },
  { label: 'Bowlers', href: '/bowlers?filter=current', description: 'Current season roster' },
  { label: 'Teams', href: '/teams?filter=current', description: 'Current season teams' },
  { label: 'Resources', href: '/resources', description: 'League links and forms' },
];

export default async function Home() {
  const [milestones, seasonSnapshot, nextBowlingNight] = await Promise.all([
    getRecentMilestones(),
    getCurrentSeasonSnapshot(),
    getNextBowlingNight(),
  ]);

  // Fetch standings + schedule for current season
  let standings: Awaited<ReturnType<typeof getSeasonStandings>> = [];
  let weekSchedule: Awaited<ReturnType<typeof getSeasonSchedule>> = [];

  let nextWeekNumber = 0;

  if (seasonSnapshot) {
    const season = await getSeasonBySlug(seasonSnapshot.slug);
    if (season) {
      const [allStandings, allSchedule, allMatchResults] = await Promise.all([
        getSeasonStandings(season.seasonID),
        getSeasonSchedule(season.seasonID),
        getSeasonMatchResults(season.seasonID),
      ]);
      standings = allStandings;

      // Find the next unplayed week (first scheduled week with no match results)
      const playedWeeks = new Set(allMatchResults.map(r => r.week));
      const scheduledWeeks = [...new Set(allSchedule.map(s => s.week))].sort((a, b) => a - b);
      nextWeekNumber = scheduledWeeks.find(w => !playedWeeks.has(w)) ?? 0;

      if (nextWeekNumber > 0) {
        weekSchedule = allSchedule.filter(s => s.week === nextWeekNumber);
      }
    }
  }

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
            <div className="mt-2 sm:hidden">
              <HeaderCountdown targetDate={nextBowlingNight} />
            </div>
          </div>

          {/* This Week's Results CTA */}
          {seasonSnapshot && (
            <Link
              href={`/week/${seasonSnapshot.slug}/${seasonSnapshot.weekNumber}`}
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

          {/* Explore Cards */}
          <div className="mt-6 sm:mt-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {quickLinks.map((link) =>
              link.href === '/stats' ? (
                <Link
                  key={link.href}
                  href={link.href}
                  className="group relative rounded-xl p-4 overflow-hidden bg-gradient-to-br from-navy via-navy/90 to-red/80 hover:shadow-lg hover:shadow-red/20 transition-all hover:scale-[1.03]"
                >
                  <div className="absolute inset-0 bg-[linear-gradient(110deg,transparent_25%,rgba(255,255,255,0.1)_50%,transparent_75%)] animate-shimmer" />
                  <div className="relative font-body text-sm font-semibold text-white group-hover:text-red-200 transition-colors">
                    {link.label}
                  </div>
                  <div className="relative font-body text-xs text-white/50 mt-1 leading-relaxed">
                    {link.description}
                  </div>
                </Link>
              ) : (
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
              )
            )}
          </div>
        </div>
      </section>

      {/* Content Grid */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-2 sm:pt-4 pb-4 sm:pb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Mini Standings */}
          <div>
            {seasonSnapshot && (
              <MiniStandings
                standings={standings}
                seasonSlug={seasonSnapshot.slug}
                romanNumeral={seasonSnapshot.romanNumeral}
              />
            )}
          </div>

          {/* Right column: This Week's Matchups + Season Snapshot */}
          <div className="space-y-6">
            {seasonSnapshot && weekSchedule.length > 0 && nextWeekNumber > 0 && (
              <ThisWeekMatchups
                matchups={weekSchedule}
                matchResults={[]}
                seasonSlug={seasonSnapshot.slug}
                weekNumber={nextWeekNumber}
                romanNumeral={seasonSnapshot.romanNumeral}
              />
            )}
            <SeasonSnapshot snapshot={seasonSnapshot} />
          </div>
        </div>
      </section>
    </div>
  );
}
