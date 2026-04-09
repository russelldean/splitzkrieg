/**
 * All-Time Stats hub page.
 * Portal to all-time leaderboards, records, and deep cuts.
 * Hook-card grid: each card teases with one headline, click to dive in.
 */
import Link from 'next/link';
import type { Metadata } from 'next';
import {
  getAllTimeLeaderboard,
  getHighGameProgression,
  getGameProfiles,
  getAllPlayoffHistory,
  getAllIndividualChampions,
} from '@/lib/queries';

export const metadata: Metadata = {
  title: 'All-Time Stats | Splitzkrieg',
  description:
    'All-time leaderboards, records, and championship history across 35+ seasons of Splitzkrieg Bowling League.',
};

export default async function AllTimeStatsPage() {
  const [leaderboard, playoffHistory, individualChampions, highGameData, profileData] = await Promise.all([
    getAllTimeLeaderboard(),
    getAllPlayoffHistory(),
    getAllIndividualChampions(),
    getHighGameProgression(),
    getGameProfiles(),
  ]);

  // Career Leaderboard: top bowler by games bowled
  const topByGames = [...leaderboard].sort((a, b) => b.gamesBowled - a.gamesBowled)[0];

  // Team Championships: most recent champion
  const latestPlayoff = playoffHistory[0];

  // Individual Champions: most recent season
  const latestIndividual = individualChampions[0];

  // High Game Record: current record score + holders
  const currentRecordScore = highGameData.records[highGameData.records.length - 1]?.score;
  const recordHolders = currentRecordScore
    ? highGameData.records.filter(r => r.score === currentRecordScore)
    : [];

  // Game Profiles: total bowlers profiled
  const profiledCount = profileData.leaderboard.length;

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-12">
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

      {/* Hero: Career Leaderboard */}
      {topByGames && (
        <Link
          href="/stats/all-time/career-leaderboard"
          className="group block mt-8 bg-white border border-navy/10 rounded-xl shadow-sm hover:shadow-md hover:border-navy/20 transition-all overflow-hidden"
        >
          <div className="px-6 py-6 sm:px-8 sm:py-7 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="font-body text-xs uppercase tracking-wider text-red-600/80 mb-1">
                Career Leaderboard
              </div>
              <div className="font-heading text-2xl sm:text-3xl text-navy group-hover:text-red-600 transition-colors">
                {topByGames.bowlerName}
              </div>
              <div className="font-body text-sm text-navy/65 mt-1">
                Most games bowled in league history
              </div>
            </div>
            <div className="flex items-baseline gap-2 sm:flex-col sm:items-end sm:gap-0">
              <div className="font-heading text-4xl sm:text-5xl text-navy tabular-nums">
                {topByGames.gamesBowled.toLocaleString()}
              </div>
              <div className="font-body text-xs uppercase tracking-wider text-navy/60">
                games
              </div>
            </div>
          </div>
          <div className="px-6 sm:px-8 py-2 bg-navy/[0.02] border-t border-navy/5 flex items-center justify-between">
            <span className="font-body text-sm text-navy/60">See the full leaderboard</span>
            <span className="font-body text-sm text-red-600 group-hover:translate-x-0.5 transition-transform">&rarr;</span>
          </div>
        </Link>
      )}

      {/* 2x2 grid: Championships, Individuals, High Game, Profiles */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* Team Championships */}
        {latestPlayoff && (
          <HookCard
            href="/stats/all-time/team-championships"
            eyebrow="Team Championships"
            hook={latestPlayoff.championHistoricName ?? latestPlayoff.championName}
            subHook={`${latestPlayoff.displayName} Champion`}
            cta="Every playoff bracket"
            accent="red"
          />
        )}

        {/* Individual Champions */}
        {latestIndividual && (
          <HookCard
            href="/stats/all-time/individual-champions"
            eyebrow="Individual Champions"
            hook={`${latestIndividual.displayName} winners`}
            subHook={[
              latestIndividual.mensScratchName,
              latestIndividual.womensScratchName,
              latestIndividual.handicapName,
            ].filter(Boolean).join(' \u00B7 ')}
            cta="All individual champs"
            accent="amber"
          />
        )}

        {/* High Game Record */}
        {currentRecordScore && recordHolders.length > 0 && (
          <Link
            href="/stats/all-time/high-game-record"
            className="group flex flex-col bg-white border border-navy/10 border-l-4 border-l-red-600/40 rounded-xl shadow-sm hover:shadow-md hover:border-navy/20 transition-all overflow-hidden"
          >
            <div className="flex-1 px-5 py-5 flex items-center gap-5">
              <div className="font-heading text-5xl sm:text-6xl text-navy tabular-nums leading-none">
                {currentRecordScore}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-body text-xs uppercase tracking-wider text-red-600/80 mb-1">
                  High Game Record
                </div>
                <div className="font-heading text-base text-navy truncate">
                  {recordHolders.length === 1
                    ? recordHolders[0].bowlerName
                    : `${recordHolders.length} bowlers tied`}
                </div>
                <div className="font-body text-xs text-navy/60 truncate">
                  {recordHolders.length === 1
                    ? recordHolders[0].displayName
                    : recordHolders.map(r => r.bowlerName).join(', ')}
                </div>
              </div>
            </div>
            <div className="px-5 py-2 bg-navy/[0.02] border-t border-navy/5 flex items-center justify-between">
              <span className="font-body text-sm text-navy/60">Record progression</span>
              <span className="font-body text-sm text-red-600 group-hover:translate-x-0.5 transition-transform">&rarr;</span>
            </div>
          </Link>
        )}

        {/* League Night Profiles */}
        <Link
          href="/stats/all-time/game-profiles"
          className="group flex flex-col bg-white border border-navy/10 border-l-4 border-l-navy/30 rounded-xl shadow-sm hover:shadow-md hover:border-navy/20 transition-all overflow-hidden"
        >
          <div className="flex-1 px-5 py-5">
            <div className="font-body text-xs uppercase tracking-wider text-red-600/80 mb-1">
              League Night Profiles
            </div>
            <div className="font-heading text-xl text-navy">
              Which one are you?
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {['Fast Starter', 'Middle Child', 'Late Bloomer', 'Flatliner'].map(a => (
                <span key={a} className="inline-block px-2 py-0.5 text-xs font-body bg-navy/[0.04] border border-navy/10 rounded-full text-navy/70">
                  {a}
                </span>
              ))}
            </div>
          </div>
          <div className="px-5 py-2 bg-navy/[0.02] border-t border-navy/5 flex items-center justify-between">
            <span className="font-body text-sm text-navy/60">
              {profiledCount.toLocaleString()} bowlers profiled
            </span>
            <span className="font-body text-sm text-red-600 group-hover:translate-x-0.5 transition-transform">&rarr;</span>
          </div>
        </Link>

      </div>
    </main>
  );
}

function HookCard({
  href,
  eyebrow,
  hook,
  subHook,
  cta,
  accent,
}: {
  href: string;
  eyebrow: string;
  hook: string;
  subHook?: string;
  cta: string;
  accent: 'red' | 'amber' | 'navy';
}) {
  const accentClass =
    accent === 'amber' ? 'border-l-amber-500/60' :
    accent === 'red' ? 'border-l-red-600/40' :
    'border-l-navy/30';

  return (
    <Link
      href={href}
      className={`group flex flex-col bg-white border border-navy/10 border-l-4 ${accentClass} rounded-xl shadow-sm hover:shadow-md hover:border-navy/20 transition-all overflow-hidden`}
    >
      <div className="flex-1 px-5 py-5">
        <div className="font-body text-xs uppercase tracking-wider text-red-600/80 mb-1">
          {eyebrow}
        </div>
        <div className="font-heading text-xl text-navy group-hover:text-red-600 transition-colors">
          {hook}
        </div>
        {subHook && (
          <div className="font-body text-sm text-navy/65 mt-1 line-clamp-2">
            {subHook}
          </div>
        )}
      </div>
      <div className="px-5 py-2 bg-navy/[0.02] border-t border-navy/5 flex items-center justify-between">
        <span className="font-body text-sm text-navy/60">{cta}</span>
        <span className="font-body text-sm text-red-600 group-hover:translate-x-0.5 transition-transform">&rarr;</span>
      </div>
    </Link>
  );
}
