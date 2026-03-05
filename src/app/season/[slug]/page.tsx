/**
 * Static season page.
 *
 * All season pages are pre-rendered at build time via generateStaticParams.
 * dynamicParams = false ensures unknown slugs return 404 immediately.
 *
 * Phase 4: Season page with hero, standings, leaderboards, records, and full stats.
 */
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import {
  getAllSeasonSlugs,
  getSeasonBySlug,
  getSeasonStandings,
  getSeasonFullStats,
  getSeasonRecords,
  getSeasonLeaderboard,
  getSeasonHeroStats,
} from '@/lib/queries';
import type { SeasonLeaderEntry } from '@/lib/queries';
import { SeasonHero } from '@/components/season/SeasonHero';
import { Standings } from '@/components/season/Standings';
import { SeasonLeaderboards } from '@/components/season/SeasonLeaderboards';
import { FullStatsTable } from '@/components/season/FullStatsTable';

// Unknown slugs return 404 -- never attempt to render or hit the DB at runtime.
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
  if (!season) return { title: 'Season Not Found | Splitzkrieg' };

  const heroStats = await getSeasonHeroStats(season.seasonID);
  const avgStr = heroStats?.leagueAverage?.toFixed(1) ?? 'N/A';
  const bowlers = heroStats?.totalBowlers ?? 0;

  const title = `Season ${season.romanNumeral} \u2014 ${season.period} ${season.year} | Splitzkrieg`;
  const description = `${season.period} ${season.year} \u2014 ${bowlers} bowlers, ${avgStr} league average. Splitzkrieg Bowling League.`;

  return {
    title,
    description,
    openGraph: {
      title: `Season ${season.romanNumeral} \u2014 ${season.period} ${season.year} | Splitzkrieg Bowling`,
      description,
      url: `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/season/${slug}`,
      siteName: 'Splitzkrieg Bowling League',
      type: 'website',
    },
  };
}

/**
 * Handicap eligibility: bowlers who are in the top 8 of men's scratch avg
 * OR top 8 of women's scratch avg are NOT eligible for handicap playoffs.
 * Filter them out of handicap leaderboards.
 */
function filterHcpEligible(
  hcpEntries: SeasonLeaderEntry[],
  mensAvg: SeasonLeaderEntry[],
  womensAvg: SeasonLeaderEntry[]
): SeasonLeaderEntry[] {
  const ineligibleIds = new Set<number>();
  // Top 8 men's scratch avg
  mensAvg.slice(0, 8).forEach((e) => ineligibleIds.add(e.bowlerID));
  // Top 8 women's scratch avg
  womensAvg.slice(0, 8).forEach((e) => ineligibleIds.add(e.bowlerID));

  return hcpEntries
    .filter((e) => !ineligibleIds.has(e.bowlerID))
    .slice(0, 10);
}

export default async function SeasonPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const season = await getSeasonBySlug(slug);
  if (!season) notFound();

  const shareUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/season/${slug}`;

  // Parallel build-time data fetching
  const [standings, fullStats, records, heroStats, ...leaderboards] = await Promise.all([
    getSeasonStandings(season.seasonID),
    getSeasonFullStats(season.seasonID),
    getSeasonRecords(season.seasonID),
    getSeasonHeroStats(season.seasonID),
    // Men's scratch leaderboards
    getSeasonLeaderboard(season.seasonID, 'M', 'avg'),
    getSeasonLeaderboard(season.seasonID, 'M', 'highGame'),
    getSeasonLeaderboard(season.seasonID, 'M', 'highSeries'),
    // Women's scratch leaderboards
    getSeasonLeaderboard(season.seasonID, 'F', 'avg'),
    getSeasonLeaderboard(season.seasonID, 'F', 'highGame'),
    getSeasonLeaderboard(season.seasonID, 'F', 'highSeries'),
    // Handicap leaderboards (all genders -- filtered below for eligibility)
    getSeasonLeaderboard(season.seasonID, null, 'hcpAvg'),
  ]);

  const [
    mensAvg, mensHighGame, mensHighSeries,
    womensAvg, womensHighGame, womensHighSeries,
    hcpAvgRaw,
  ] = leaderboards;

  // Filter handicap leaders: exclude top 8 men's + top 8 women's scratch avg
  const hcpAvg = filterHcpEligible(hcpAvgRaw, mensAvg, womensAvg);

  const hasDivisions = standings.some((row) => row.divisionName !== null);

  // Check if this is an archival season (no schedule data available)
  // Schedule data exists for seasons XXVI onwards (seasonID >= 26 roughly, but use year heuristic)
  const isArchival = season.year < 2019;

  return (
    <main className="container mx-auto px-4 py-8 max-w-5xl">
      <SeasonHero season={season} heroStats={heroStats} shareUrl={shareUrl} />

      <div className="mt-8 space-y-12">
        <Standings standings={standings} hasDivisions={hasDivisions} />

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
            { title: 'Top 10 Average (HCP)', entries: hcpAvg },
          ]}
          records={records}
        />

        <FullStatsTable stats={fullStats} />

        {/* Weekly results placeholder -- built in Plan 04 */}
        {isArchival && (
          <div className="bg-navy/[0.02] rounded-lg px-6 py-4">
            <p className="font-body text-sm text-navy/50 italic">
              This is an archival season page. Weekly results are available from Season XXVI onwards.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
