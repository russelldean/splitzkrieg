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
  getSeasonWeeklyScores,
  getSeasonSchedule,
} from '@/lib/queries';
import type { SeasonLeaderEntry } from '@/lib/queries';
import { SeasonHero } from '@/components/season/SeasonHero';
import { Standings } from '@/components/season/Standings';
import { SeasonLeaderboards } from '@/components/season/SeasonLeaderboards';
import { SeasonRecordsSection } from '@/components/season/SeasonRecordsSection';
import { FullStatsTable } from '@/components/season/FullStatsTable';
import { WeeklyResults } from '@/components/season/WeeklyResults';
import { StandingsRaceChart } from '@/components/season/StandingsRaceChart';

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
 * Build the full handicap leaderboard from fullStats.
 * All bowlers ranked by hcpAvg. Those NOT in the top 8 of men's/women's
 * scratch avg are handicap-eligible. We show enough bowlers to display
 * at least 10 eligible ones.
 */
function buildHcpLeaderboard(
  fullStats: import('@/lib/queries').SeasonFullStatsRow[],
  mensAvg: SeasonLeaderEntry[],
  womensAvg: SeasonLeaderEntry[]
): { entries: SeasonLeaderEntry[]; eligibleIDs: Set<number> } {
  const ineligibleIds = new Set<number>();
  mensAvg.slice(0, 8).forEach((e) => ineligibleIds.add(e.bowlerID));
  womensAvg.slice(0, 8).forEach((e) => ineligibleIds.add(e.bowlerID));

  // Build leaderboard entries from fullStats, sorted by hcpAvg DESC
  const hcpRows = fullStats
    .filter((s) => s.hcpAvg != null && s.gamesBowled >= 9) // minimum 3 nights
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

  // Find how many rows needed to show 10 eligible bowlers
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
    hcpRows
      .filter((e) => !ineligibleIds.has(e.bowlerID))
      .map((e) => e.bowlerID)
  );

  return { entries: hcpRows.slice(0, cutoff), eligibleIDs };
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
  const [standings, fullStats, records, heroStats, weeklyScores, schedule, ...leaderboards] = await Promise.all([
    getSeasonStandings(season.seasonID),
    getSeasonFullStats(season.seasonID),
    getSeasonRecords(season.seasonID),
    getSeasonHeroStats(season.seasonID),
    getSeasonWeeklyScores(season.seasonID),
    getSeasonSchedule(season.seasonID),
    // Men's scratch leaderboards
    getSeasonLeaderboard(season.seasonID, 'M', 'avg'),
    getSeasonLeaderboard(season.seasonID, 'M', 'highGame'),
    getSeasonLeaderboard(season.seasonID, 'M', 'highSeries'),
    // Women's scratch leaderboards
    getSeasonLeaderboard(season.seasonID, 'F', 'avg'),
    getSeasonLeaderboard(season.seasonID, 'F', 'highGame'),
    getSeasonLeaderboard(season.seasonID, 'F', 'highSeries'),
  ]);

  const [
    mensAvg, mensHighGame, mensHighSeries,
    womensAvg, womensHighGame, womensHighSeries,
  ] = leaderboards;

  // Build handicap leaderboard from fullStats -- shows all bowlers ranked by hcpAvg
  // with eligible bowlers (not in top 8 scratch) highlighted
  const { entries: hcpEntries, eligibleIDs: hcpEligibleIDs } = buildHcpLeaderboard(
    fullStats, mensAvg, womensAvg
  );

  // Scratch playoff IDs: top 8 men's and women's scratch avg make playoffs
  const mensScratchPlayoffIDs = new Set(mensAvg.slice(0, 8).map(e => e.bowlerID));
  const womensScratchPlayoffIDs = new Set(womensAvg.slice(0, 8).map(e => e.bowlerID));

  const hasDivisions = standings.some((row) => row.divisionName !== null);

  // Schedule data exists for seasons XXVI onwards -- use schedule array to determine
  const hasScheduleData = schedule.length > 0;

  // Determine total weeks from max week in scores or schedule
  const maxScoreWeek = weeklyScores.length > 0
    ? Math.max(...weeklyScores.map(s => s.week))
    : 0;
  const maxScheduleWeek = schedule.length > 0
    ? Math.max(...schedule.map(s => s.week))
    : 0;
  const totalWeeks = Math.max(maxScoreWeek, maxScheduleWeek);

  return (
    <main className="container mx-auto px-4 py-8 max-w-5xl">
      <SeasonHero season={season} heroStats={heroStats} shareUrl={shareUrl} />

      <div className="mt-8 space-y-12">
        <Standings standings={standings} hasDivisions={hasDivisions} />

        {hasScheduleData && weeklyScores.length > 0 && (
          <StandingsRaceChart weeklyScores={weeklyScores} standings={standings} />
        )}

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
        />

        <FullStatsTable stats={fullStats} />

        {hasScheduleData ? (
          <WeeklyResults
            weeklyScores={weeklyScores}
            schedule={schedule}
            totalWeeks={totalWeeks}
          />
        ) : (
          <div className="bg-navy/[0.02] rounded-lg px-6 py-4">
            <p className="font-body text-sm text-navy/50 italic">
              This is an archival season page. Weekly results are available from Season XXVI onwards.
            </p>
          </div>
        )}

        <SeasonRecordsSection records={records} />
      </div>
    </main>
  );
}
