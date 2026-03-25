/**
 * Per-season stats page.
 * Shows leaderboards and full stats for a specific season.
 * Pre-rendered at build time via generateStaticParams.
 */
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import {
  getAllSeasonSlugs,
  getSeasonBySlug,
  getSeasonLeaderboard,
  getSeasonFullStats,
  getSeasonWeeklyScores,
  getMinGamesForWeek,
  getAllSeasonNavList,
  getSeasonIndividualChampions,
} from '@/lib/queries';
import type { SeasonLeaderEntry } from '@/lib/queries';
import { SeasonLeaderboards } from '@/components/season/SeasonLeaderboards';
import { SeasonNav } from '@/components/season/SeasonNav';
import { TrailNav } from '@/components/ui/TrailNav';
import { NextStopNudge } from '@/components/ui/NextStopNudge';
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

/** Return IDs of the top 8 entries plus any tied at the 8th value. */
function playoffQualifiers(entries: SeasonLeaderEntry[]): Set<number> {
  if (entries.length <= 8) return new Set(entries.map(e => e.bowlerID));
  const cutoffValue = entries[7].value;
  const ids = new Set<number>();
  for (const e of entries) {
    if (e.value >= cutoffValue) ids.add(e.bowlerID);
    else break;
  }
  return ids;
}

function buildHcpLeaderboard(
  fullStats: import('@/lib/queries').SeasonFullStatsRow[],
  mensAvg: SeasonLeaderEntry[],
  womensAvg: SeasonLeaderEntry[],
  minGames: number = 9
): { entries: SeasonLeaderEntry[]; playoffIDs: Set<number>; ineligibleIDs: Set<number> } {
  const ineligibleIds = new Set<number>();
  playoffQualifiers(mensAvg).forEach((id) => ineligibleIds.add(id));
  playoffQualifiers(womensAvg).forEach((id) => ineligibleIds.add(id));

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

  const eligible = hcpRows.filter(r => !ineligibleIds.has(r.bowlerID));
  const playoffIDs = playoffQualifiers(eligible);

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

  const [fullStats, weeklyScores, allSeasons, champions] = await Promise.all([
    getSeasonFullStats(season.seasonID),
    getSeasonWeeklyScores(season.seasonID),
    getAllSeasonNavList(),
    getSeasonIndividualChampions(season.seasonID),
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

  const mensScratchPlayoffIDs = playoffQualifiers(mensAvg);
  const womensScratchPlayoffIDs = playoffQualifiers(womensAvg);

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
      <TrailNav current="/stats" seasonSlug={slug} seasonRoman={season.romanNumeral} position="top" />

      <div className="pb-5 border-b border-red-600/20">
        <h1 className="font-heading text-3xl md:text-4xl lg:text-5xl text-navy">
          Season {strikeX(season.romanNumeral)}
        </h1>
        <p className="font-body text-sm text-navy/55 mt-1">
          Stats &middot; {season.period} {season.year}
        </p>
      </div>
      <SeasonNav current={season} allSeasons={allSeasons} basePath="/stats" />

      {season.notes && (
        <div className="mt-4 px-4 py-3 rounded-lg bg-navy/[0.03] border border-navy/10">
          <p className="font-body text-sm text-navy/65 italic">
            Note: {season.notes}
          </p>
        </div>
      )}

      <div className="mt-6 space-y-12">
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
          champions={champions}
        />

        <div id="stats">
          <FullStatsTable stats={fullStats} minGames={minGames} champions={champions} />
        </div>
      </div>

      <NextStopNudge currentPage="stats" />
    </main>
  );
}
