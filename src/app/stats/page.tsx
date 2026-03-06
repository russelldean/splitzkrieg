/**
 * The Stats page — Season Leaders (default), All-Time Leaders, More Stats.
 * Season leaderboards moved here from the season page.
 */
import Link from 'next/link';
import type { Metadata } from 'next';
import {
  getCurrentSeasonSnapshot,
  getSeasonBySlug,
  getSeasonLeaderboard,
  getSeasonFullStats,
  getSeasonWeeklyScores,
  getMinGamesForWeek,
} from '@/lib/queries';
import type { SeasonLeaderEntry } from '@/lib/queries';
import { SeasonLeaderboards } from '@/components/season/SeasonLeaderboards';
import { FullStatsTable } from '@/components/season/FullStatsTable';

export const metadata: Metadata = {
  title: 'The Stats | Splitzkrieg',
  description: 'Season leaderboards, all-time records, and more stats for the Splitzkrieg Bowling League.',
};

function buildHcpLeaderboard(
  fullStats: import('@/lib/queries').SeasonFullStatsRow[],
  mensAvg: SeasonLeaderEntry[],
  womensAvg: SeasonLeaderEntry[],
  minGames: number = 9
): { entries: SeasonLeaderEntry[]; eligibleIDs: Set<number> } {
  const ineligibleIds = new Set<number>();
  mensAvg.slice(0, 8).forEach((e) => ineligibleIds.add(e.bowlerID));
  womensAvg.slice(0, 8).forEach((e) => ineligibleIds.add(e.bowlerID));

  const hcpRows = fullStats
    .filter((s) => s.hcpAvg != null && s.gamesBowled >= minGames)
    .sort((a, b) => (b.hcpAvg ?? 0) - (a.hcpAvg ?? 0))
    .map((s, i) => ({
      bowlerID: s.bowlerID,
      bowlerName: s.bowlerName,
      slug: s.slug,
      teamName: s.teamName,
      teamSlug: s.teamSlug,
      value: s.hcpAvg!,
      rank: i + 1,
    }));

  let eligibleCount = 0;
  let cutoff = hcpRows.length;
  for (let i = 0; i < hcpRows.length; i++) {
    if (!ineligibleIds.has(hcpRows[i].bowlerID)) {
      eligibleCount++;
      if (eligibleCount >= 10) {
        cutoff = i + 1;
        break;
      }
    }
  }

  const eligibleIDs = new Set<number>(
    hcpRows.filter((e) => !ineligibleIds.has(e.bowlerID)).map((e) => e.bowlerID)
  );

  return { entries: hcpRows.slice(0, cutoff), eligibleIDs };
}

export default async function StatsPage() {
  const snapshot = await getCurrentSeasonSnapshot();
  if (!snapshot) {
    return (
      <main className="container mx-auto px-4 py-8 max-w-5xl">
        <h1 className="font-heading text-3xl sm:text-4xl text-navy mb-4">The Stats</h1>
        <p className="font-body text-navy/50">No season data available.</p>
      </main>
    );
  }

  const season = await getSeasonBySlug(snapshot.slug);
  if (!season) return null;

  const [fullStats, weeklyScores] = await Promise.all([
    getSeasonFullStats(season.seasonID),
    getSeasonWeeklyScores(season.seasonID),
  ]);

  const currentWeek = weeklyScores.length > 0
    ? Math.max(...weeklyScores.map(s => s.week))
    : 1;
  const minGames = getMinGamesForWeek(currentWeek);

  const leaderboards = await Promise.all([
    getSeasonLeaderboard(season.seasonID, 'M', 'avg', minGames),
    getSeasonLeaderboard(season.seasonID, 'M', 'highGame'),
    getSeasonLeaderboard(season.seasonID, 'M', 'highSeries'),
    getSeasonLeaderboard(season.seasonID, 'F', 'avg', minGames),
    getSeasonLeaderboard(season.seasonID, 'F', 'highGame'),
    getSeasonLeaderboard(season.seasonID, 'F', 'highSeries'),
  ]);

  const [mensAvg, mensHighGame, mensHighSeries, womensAvg, womensHighGame, womensHighSeries] = leaderboards;

  const { entries: hcpEntries, eligibleIDs: hcpEligibleIDs } = buildHcpLeaderboard(
    fullStats, mensAvg, womensAvg, minGames
  );

  const mensScratchPlayoffIDs = new Set(mensAvg.slice(0, 8).map(e => e.bowlerID));
  const womensScratchPlayoffIDs = new Set(womensAvg.slice(0, 8).map(e => e.bowlerID));

  return (
    <main className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="font-heading text-3xl sm:text-4xl text-navy">The Stats</h1>
        <p className="font-body text-sm text-navy/50 mt-1">
          Season {season.romanNumeral} &middot; {season.period} {season.year}
        </p>
      </div>

      {/* Section jump links */}
      <nav className="mb-8 flex flex-wrap gap-2 text-xs font-body">
        <a href="#leaderboards" className="text-navy/50 hover:text-red-600 transition-colors px-2 py-1 rounded bg-navy/[0.03]">Season Leaders</a>
        <a href="#stats" className="text-navy/50 hover:text-red-600 transition-colors px-2 py-1 rounded bg-navy/[0.03]">Full Stats</a>
        <span className="text-navy/30 px-2 py-1 rounded bg-navy/[0.02] cursor-default">All-Time Leaders (coming soon)</span>
      </nav>

      <div className="space-y-12">
        <SeasonLeaderboards
          mensScratch={[
            { title: 'Top 10 Average', entries: mensAvg },
            { title: 'Top 10 High Game', entries: mensHighGame },
            { title: 'Top 10 High Series', entries: mensHighSeries },
          ]}
          womensScratch={[
            { title: 'Top 10 Average', entries: womensAvg },
            { title: 'Top 10 High Game', entries: womensHighGame },
            { title: 'Top 10 High Series', entries: womensHighSeries },
          ]}
          handicap={[
            { title: 'Handicap Average', entries: hcpEntries },
          ]}
          mensScratchPlayoffIDs={mensScratchPlayoffIDs}
          womensScratchPlayoffIDs={womensScratchPlayoffIDs}
          hcpEligibleIDs={hcpEligibleIDs}
          minGames={minGames}
        />

        <div id="stats">
          <FullStatsTable stats={fullStats} />
        </div>

        {/* All-Time Leaders placeholder */}
        <section className="bg-navy/[0.02] rounded-lg px-6 py-8 text-center">
          <h2 className="font-heading text-2xl text-navy mb-2">All-Time Leaders</h2>
          <p className="font-body text-navy/50">
            Career records and all-time rankings coming soon.
          </p>
        </section>
      </div>

      {/* Cross-links */}
      <div className="mt-8 pt-6 border-t border-navy/10 flex flex-wrap gap-4">
        <Link
          href={`/season/${snapshot.slug}`}
          className="text-sm font-body text-navy/50 hover:text-red-600 transition-colors"
        >
          Season {season.romanNumeral} Overview
        </Link>
        <Link
          href="/bowlers"
          className="text-sm font-body text-navy/50 hover:text-red-600 transition-colors"
        >
          Browse Bowlers
        </Link>
      </div>
    </main>
  );
}
