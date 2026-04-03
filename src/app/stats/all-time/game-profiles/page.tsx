/**
 * Game Profiles leaderboard page.
 * Shows bowlers ranked by how strongly they skew toward a particular game,
 * plus the most consistent "Flatliners."
 */
import Link from 'next/link';
import type { Metadata } from 'next';
import { getGameProfiles } from '@/lib/queries/alltime';
import type { GameProfileRow, GameArchetype } from '@/lib/queries/alltime';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { GameProfileLeaderboard } from '@/components/alltime/GameProfileLeaderboard';

export const metadata: Metadata = {
  title: 'League Night Profiles | Splitzkrieg',
  description:
    'Are you a Fast Starter, Middle Child, Late Bloomer, or Flatliner? See which game of the night every bowler peaks in.',
};

export default async function GameProfilesPage() {
  const { all, leaderboard } = await getGameProfiles();

  // Distribution cards use ALL bowlers
  const totalAll = all.length;
  const dist = {
    'Fast Starter': all.filter(b => b.archetype === 'Fast Starter').length,
    'Middle Child': all.filter(b => b.archetype === 'Middle Child').length,
    'Late Bloomer': all.filter(b => b.archetype === 'Late Bloomer').length,
    'Flatliner': all.filter(b => b.archetype === 'Flatliner').length,
  };

  // Active bowler distribution (27+ games, currently active)
  const active = all.filter(b => b.isActive);
  const totalActive = active.length;
  const activeDist = {
    'Fast Starter': active.filter(b => b.archetype === 'Fast Starter').length,
    'Middle Child': active.filter(b => b.archetype === 'Middle Child').length,
    'Late Bloomer': active.filter(b => b.archetype === 'Late Bloomer').length,
    'Flatliner': active.filter(b => b.archetype === 'Flatliner').length,
  };

  // Sort by how much their best game exceeds their avg (relative %)
  const bestGamePct = (b: typeof leaderboard[0]) => {
    const avgs = [b.avg1, b.avg2, b.avg3];
    return ((avgs[b.bestGame - 1] / b.overallAvg) - 1) * 100;
  };

  // Leaderboard tables use active 27+ game bowlers only
  const fastStarters = leaderboard
    .filter(b => b.archetype === 'Fast Starter')
    .sort((a, b) => bestGamePct(b) - bestGamePct(a));

  const middleChildren = leaderboard
    .filter(b => b.archetype === 'Middle Child')
    .sort((a, b) => bestGamePct(b) - bestGamePct(a));

  const lateBoomers = leaderboard
    .filter(b => b.archetype === 'Late Bloomer')
    .sort((a, b) => bestGamePct(b) - bestGamePct(a));

  const flatliners = leaderboard
    .filter(b => b.archetype === 'Flatliner')
    .sort((a, b) => a.pctSpread - b.pctSpread);

  // Single scale for all mini charts across all sections
  const globalMaxPct = Math.max(
    ...leaderboard.flatMap(b =>
      [b.avg1, b.avg2, b.avg3].map(v => Math.abs((v / b.overallAvg - 1) * 100))
    ),
    0.1,
  );

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-12">
      <div className="flex items-center gap-2 text-sm font-body text-navy/65 mb-4">
        <Link href="/stats" className="hover:text-red-600 transition-colors">Stats</Link>
        <span className="text-navy/30">/</span>
        <Link href="/stats/all-time" className="hover:text-red-600 transition-colors">All-Time</Link>
        <span className="text-navy/30">/</span>
        <span className="text-navy/70">League Night Profiles</span>
      </div>

      <h1 className="font-heading text-3xl md:text-4xl lg:text-5xl text-navy">
        League Night Profiles
      </h1>
      <p className="font-body text-lg text-navy/60 mt-1">
        Everyone bowls three games a night. Which one is your best?
      </p>
      <p className="font-body text-sm text-navy/65 mt-2">
        Find your personal game profile at the bottom of <Link href="/bowlers" className="text-red-600 hover:text-red-700">your bowler page</Link>.
      </p>

      {/* Distribution summary — Active / 27+ Games */}
      <p className="mt-6 font-heading text-sm text-navy mb-2">Active / 27+ Games ({totalActive})</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <DistCard archetype="Fast Starter" count={activeDist['Fast Starter']} total={totalActive} desc="Best in Game 1" color="bg-orange-50 border-orange-200" />
        <DistCard archetype="Middle Child" count={activeDist['Middle Child']} total={totalActive} desc="Best in Game 2" color="bg-purple-50 border-purple-200" />
        <DistCard archetype="Late Bloomer" count={activeDist['Late Bloomer']} total={totalActive} desc="Best in Game 3" color="bg-emerald-50 border-emerald-200" />
        <DistCard archetype="Flatliner" count={activeDist['Flatliner']} total={totalActive} desc="Consistent all night" color="bg-slate-50 border-slate-200" />
      </div>

      {/* Distribution summary — All Bowlers: desktop only */}
      <div className="hidden sm:block">
        <p className="mt-5 font-heading text-sm text-navy mb-2">All Bowlers ({totalAll})</p>
        <div className="grid grid-cols-4 gap-3">
          <DistCard archetype="Fast Starter" count={dist['Fast Starter']} total={totalAll} desc="Best in Game 1" color="bg-orange-50 border-orange-200" />
          <DistCard archetype="Middle Child" count={dist['Middle Child']} total={totalAll} desc="Best in Game 2" color="bg-purple-50 border-purple-200" />
          <DistCard archetype="Late Bloomer" count={dist['Late Bloomer']} total={totalAll} desc="Best in Game 3" color="bg-emerald-50 border-emerald-200" />
          <DistCard archetype="Flatliner" count={dist['Flatliner']} total={totalAll} desc="Consistent all night" color="bg-slate-50 border-slate-200" />
        </div>
      </div>

      <p className="font-body text-xs text-navy/65 mt-3">
        The league as a whole gets better as the night goes on.
      </p>

      {/* Leaderboards */}
      <div className="mt-10 space-y-10">
        <GameProfileLeaderboard
          title="Fast Starters"
          subtitle="Highest Game 1 skew"
          bowlers={fastStarters}
          globalMaxPct={globalMaxPct}
          sortLabel="most extreme"
        />
        <GameProfileLeaderboard
          title="Middle Children"
          subtitle="Highest Game 2 skew"
          bowlers={middleChildren}
          globalMaxPct={globalMaxPct}
          sortLabel="most extreme"
        />
        <GameProfileLeaderboard
          title="Late Bloomers"
          subtitle="Highest Game 3 skew"
          bowlers={lateBoomers}
          globalMaxPct={globalMaxPct}
          sortLabel="most extreme"
        />
        <GameProfileLeaderboard
          title="Flatliners"
          subtitle="Most consistent across all 3 games"
          bowlers={flatliners}
          globalMaxPct={globalMaxPct}
          note="Note: Bowlers with more games tend to have more consistent averages, because that's how math works."
          sortLabel="most consistent"
          invertSkew
        />
      </div>

    </main>
  );
}

function DistCard({ archetype, count, total, desc, color }: {
  archetype: GameArchetype;
  count: number;
  total: number;
  desc: string;
  color: string;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className={`rounded-lg border shadow-sm px-3 py-2.5 ${color}`}>
      <div className="font-heading text-sm text-navy">{archetype}</div>
      <div className="font-heading text-2xl text-navy tabular-nums">{count}</div>
      <div className="text-[11px] text-navy/65 font-body">{pct}% &middot; {desc}</div>
    </div>
  );
}
