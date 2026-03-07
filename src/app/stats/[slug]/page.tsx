/**
 * Per-season stats page.
 * Shows leaderboards and full stats for a specific season.
 * Pre-rendered at build time via generateStaticParams.
 */
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import {
  getAllSeasonSlugs,
  getSeasonBySlug,
  getSeasonLeaderboard,
  getSeasonFullStats,
  getSeasonWeeklyScores,
  getMinGamesForWeek,
  getAllSeasonNavList,
} from '@/lib/queries';
import type { SeasonLeaderEntry } from '@/lib/queries';
import { SeasonLeaderboards } from '@/components/season/SeasonLeaderboards';
import { SeasonNav } from '@/components/season/SeasonNav';
import { FullStatsTable } from '@/components/season/FullStatsTable';
import { strikeX } from '@/components/ui/StrikeX';

export const dynamicParams = false;

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  const slugs = await getAllSeasonSlugs();
  return slugs.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const season = await getSeasonBySlug(slug);
  if (!season) return { title: 'Stats Not Found | Splitzkrieg' };

  return {
    title: `Stats - Season ${season.romanNumeral} | Splitzkrieg`,
    description: `Leaderboards and full stats for ${season.period} ${season.year} (Season ${season.romanNumeral}). Splitzkrieg Bowling League.`,
  };
}

function buildHcpLeaderboard(
  fullStats: import('@/lib/queries').SeasonFullStatsRow[],
  mensAvg: SeasonLeaderEntry[],
  womensAvg: SeasonLeaderEntry[],
  minGames: number = 9
): { entries: SeasonLeaderEntry[]; playoffIDs: Set<number>; ineligibleIDs: Set<number> } {
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

  const playoffIDs = new Set<number>();
  let playoffCount = 0;
  for (const row of hcpRows) {
    if (!ineligibleIds.has(row.bowlerID)) {
      playoffIDs.add(row.bowlerID);
      playoffCount++;
      if (playoffCount >= 8) break;
    }
  }

  const displayedIneligible = new Set<number>(
    hcpRows.slice(0, cutoff).filter((e) => ineligibleIds.has(e.bowlerID)).map((e) => e.bowlerID)
  );

  return { entries: hcpRows.slice(0, cutoff), playoffIDs, ineligibleIDs: displayedIneligible };
}

export default async function SeasonStatsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const season = await getSeasonBySlug(slug);
  if (!season) notFound();

  const [fullStats, weeklyScores, allSeasons] = await Promise.all([
    getSeasonFullStats(season.seasonID),
    getSeasonWeeklyScores(season.seasonID),
    getAllSeasonNavList(),
  ]);

  const currentWeek = weeklyScores.length > 0
    ? Math.max(...weeklyScores.map(s => s.week))
    : 1;
  const minGames = getMinGamesForWeek(currentWeek);

  const leaderboards = await Promise.all([
    getSeasonLeaderboard(season.seasonID, 'M', 'avg', minGames),
    getSeasonLeaderboard(season.seasonID, 'M', 'highGame'),
    getSeasonLeaderboard(season.seasonID, 'F', 'avg', minGames),
    getSeasonLeaderboard(season.seasonID, 'F', 'highGame'),
  ]);

  const [mensAvg, mensHighGame, womensAvg, womensHighGame] = leaderboards;

  const { entries: hcpEntries, playoffIDs: hcpPlayoffIDs, ineligibleIDs: hcpIneligibleIDs } = buildHcpLeaderboard(
    fullStats, mensAvg, womensAvg, minGames
  );

  const mensScratchPlayoffIDs = new Set(mensAvg.slice(0, 8).map(e => e.bowlerID));
  const womensScratchPlayoffIDs = new Set(womensAvg.slice(0, 8).map(e => e.bowlerID));

  return (
    <main className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="flex items-center gap-2 text-sm font-body text-navy/50 mb-4">
        <Link href="/seasons" className="hover:text-red-600 transition-colors">Seasons</Link>
        <span className="text-navy/30">/</span>
        <Link href={`/season/${slug}`} className="hover:text-red-600 transition-colors">Season {season.romanNumeral}</Link>
        <span className="text-navy/30">/</span>
        <span className="text-navy/70">Stats</span>
      </div>

      <div className="mb-8">
        <h1 className="font-heading text-3xl md:text-4xl lg:text-5xl text-navy">
          Season {strikeX(season.romanNumeral)}
        </h1>
        <p className="font-body text-lg text-navy/60 mt-1">
          The Stats &middot; {season.period} {season.year}
        </p>
        <SeasonNav current={season} allSeasons={allSeasons} basePath="/stats" />
      </div>

      <div className="space-y-12">
        <SeasonLeaderboards
          mensScratch={[
            { title: 'Top 10 Average', entries: mensAvg },
            { title: 'Top 10 High Game', entries: mensHighGame },
          ]}
          womensScratch={[
            { title: 'Top 10 Average', entries: womensAvg },
            { title: 'Top 10 High Game', entries: womensHighGame },
          ]}
          handicap={[
            { title: 'Handicap Average', entries: hcpEntries },
          ]}
          mensScratchPlayoffIDs={mensScratchPlayoffIDs}
          womensScratchPlayoffIDs={womensScratchPlayoffIDs}
          hcpPlayoffIDs={hcpPlayoffIDs}
          hcpIneligibleIDs={hcpIneligibleIDs}
          minGames={minGames}
        />

        <div id="stats">
          <FullStatsTable stats={fullStats} minGames={minGames} />
        </div>
      </div>

      {/* Cross-links */}
      <div className="mt-8 pt-6 border-t border-navy/10 flex flex-wrap gap-4">
        <Link
          href={`/season/${slug}`}
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
