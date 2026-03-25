/**
 * Static bowler profile page.
 *
 * All bowler pages are pre-rendered at build time via generateStaticParams.
 * dynamicParams = false ensures unknown slugs return 404 immediately --
 * the DB is never queried at runtime.
 *
 * Phase 2: Complete bowler profile with all five sections:
 * Hero header, personal records, average progression chart, season stats table, game log.
 */
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import {
  getAllBowlerSlugs,
  getBowlerBySlug,
  getBowlerCareerSummary,
  getBowlerSeasonStats,
  getBowlerGameLog,
  getBowlerRollingAvgHistory,
  getBowlerOfTheWeek,
  getCurrentSeasonID,
  getCurrentSeasonSlug,
  getBowlerStarStats,
  getBowlerPatches,
  getWeeklyHighlights,
  getLeagueMilestones,
  milestoneTickerItems,
} from '@/lib/queries';
import { getBowlerGameProfile, getLeagueGameAvgs } from '@/lib/queries/alltime';
import { BowlerHero } from '@/components/bowler/BowlerHero';
import { PersonalRecordsPanel } from '@/components/bowler/PersonalRecordsPanel';
import { LastWeekHighlight } from '@/components/bowler/LastWeekHighlight';
import type { WeekDelta } from '@/components/bowler/LastWeekHighlight';
import { SeasonStatsTable } from '@/components/bowler/SeasonStatsTable';
import { AverageProgressionChart } from '@/components/bowler/AverageProgressionChart';
import { GameLog } from '@/components/bowler/GameLog';
import { YouAreAStar } from '@/components/bowler/YouAreAStar';
import { GameProfile } from '@/components/bowler/GameProfile';
import { MilestoneWatch } from '@/components/bowler/MilestoneWatch';
import { TrackVisibility } from '@/components/tracking/TrackVisibility';
import { TrailNav } from '@/components/ui/TrailNav';
import { StickyContextBar } from '@/components/ui/StickyContextBar';
import type { TeamStat } from '@/components/bowler/TeamBreakdown';
import { computePersonalMilestones } from '@/lib/milestone-config';

// Unknown slugs return 404 -- never attempt to render or hit the DB at runtime.
export const dynamicParams = false;

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  const slugs = await getAllBowlerSlugs();
  return slugs.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const bowler = await getBowlerBySlug(slug);
  if (!bowler) return { title: 'Bowler Not Found | Splitzkrieg' };

  // React.cache on getBowlerCareerSummary deduplicates this call
  // (same bowlerID will be called again in the page component)
  const summary = await getBowlerCareerSummary(bowler.bowlerID);
  const avgStr = summary?.careerAverage?.toFixed(1) ?? 'N/A';
  const games = summary?.totalGamesBowled ?? 0;
  const seasons = summary?.seasonsPlayed ?? 0;

  return {
    title: `${bowler.bowlerName} | Splitzkrieg`,
    description: `${bowler.bowlerName} \u2014 ${avgStr} career average \u00b7 ${games} games across ${seasons} seasons. Splitzkrieg Bowling League.`,
    openGraph: {
      title: `${bowler.bowlerName} | Splitzkrieg Bowling`,
      description: `Career average: ${avgStr} \u00b7 ${games} games bowled`,
      url: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://splitzkrieg.com'}/bowler/${slug}`,
      siteName: 'Splitzkrieg Bowling League',
      type: 'profile',
    },
  };
}

export default async function BowlerPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const bowler = await getBowlerBySlug(slug);
  if (!bowler) notFound();

  const shareUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://splitzkrieg.com'}/bowler/${slug}`;

  // Parallel build-time data fetching
  const [careerSummary, seasonStats, gameLog, rollingAvgHistory, botwID, currentSeasonID, currentSlug, starStats, patches, tickerItems, leagueMilestones, gameProfile, leagueGameAvgs] = await Promise.all([
    getBowlerCareerSummary(bowler.bowlerID),
    getBowlerSeasonStats(bowler.bowlerID),
    getBowlerGameLog(bowler.bowlerID),
    getBowlerRollingAvgHistory(bowler.bowlerID),
    getBowlerOfTheWeek(),
    getCurrentSeasonID(),
    getCurrentSeasonSlug(),
    getBowlerStarStats(bowler.bowlerID),
    getBowlerPatches(bowler.bowlerID),
    getWeeklyHighlights(),
    getLeagueMilestones(),
    getBowlerGameProfile(slug),
    getLeagueGameAvgs(),
  ]);

  const isBowlerOfTheWeek = botwID === bowler.bowlerID;

  // Derive team breakdown from season stats
  const teamMap = new Map<string, { teamName: string; teamSlug: string | null; nights: number }>();
  for (const s of seasonStats) {
    const key = s.teamSlug ?? s.canonicalTeamName ?? s.teamName ?? 'Unknown';
    const existing = teamMap.get(key);
    if (existing) {
      existing.nights += s.nightsBowled;
    } else {
      teamMap.set(key, { teamName: s.canonicalTeamName ?? s.teamName ?? 'Unknown', teamSlug: s.teamSlug, nights: s.nightsBowled });
    }
  }
  const totalNights = seasonStats.reduce((sum, s) => sum + s.nightsBowled, 0);
  const teams: TeamStat[] = Array.from(teamMap.values())
    .sort((a, b) => b.nights - a.nights)
    .map(t => ({
      teamName: t.teamName,
      teamSlug: t.teamSlug,
      nights: t.nights,
      pct: totalNights > 0 ? Math.round((t.nights / totalNights) * 100) : 0,
    }));

  // Current avg = rolling 27-game average (used for handicap on bowling nights)
  const currentAvg = careerSummary?.rollingAvg?.toFixed(1) ?? null;
  const rollingAvgDelta = careerSummary?.rollingAvg != null && careerSummary?.prevRollingAvg != null
    ? careerSummary.rollingAvg - careerSummary.prevRollingAvg
    : null;

  // Compute last-week deltas (only for current season bowlers)
  // seasonStats is newest-first, gameLog is newest-season-first with ascending weeks within
  const latestSeason = seasonStats.length > 0 ? seasonStats[0] : null;
  const latestSeasonLog = gameLog.filter(w => latestSeason && w.seasonID === latestSeason.seasonID);
  const lastWeek = latestSeasonLog.length > 0 ? latestSeasonLog[latestSeasonLog.length - 1] : null;

  // Only show deltas for bowlers active in the current season
  const isCurrentSeason = latestSeason != null && latestSeason.seasonID === currentSeasonID;

  let weekDelta: WeekDelta | null = null;
  if (isCurrentSeason && lastWeek && careerSummary) {
    const games = [lastWeek.game1, lastWeek.game2, lastWeek.game3].filter(
      (g): g is number => g !== null && g > 0
    );
    const weekPins = games.reduce((sum, g) => sum + g, 0);
    const weekMaxGame = games.length > 0 ? Math.max(...games) : 0;
    const weekSeries = lastWeek.scratchSeries ?? 0;
    const week200 = games.filter(g => g >= 200).length;
    const weekSeries600 = weekSeries >= 600 ? 1 : 0;

    // Rolling avg change: current rolling avg (includes this week) minus incomingAvg (before this week)
    const avgChange = careerSummary.rollingAvg != null && lastWeek.incomingAvg != null
      ? careerSummary.rollingAvg - lastWeek.incomingAvg
      : null;

    weekDelta = {
      totalPins: weekPins,
      totalGames: games.length,
      games200Plus: week200,
      series600Plus: weekSeries600,
      turkeys: lastWeek.turkeys,
      avgChange,
      newHighGame: careerSummary.highGame !== null && weekMaxGame >= careerSummary.highGame,
      newHighSeries: careerSummary.highSeries !== null && weekSeries >= careerSummary.highSeries,
    };
  }

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-12">
      <TrailNav current="/bowlers" seasonSlug={currentSlug} position="top" />
      <StickyContextBar
        name={careerSummary?.bowlerName ?? bowler.bowlerName}
        detail={currentAvg ? `${currentAvg} avg` : undefined}
      />
      <BowlerHero
        careerSummary={careerSummary}
        currentAvg={currentAvg}
        currentAvgDelta={isCurrentSeason && rollingAvgDelta !== null
          ? `${rollingAvgDelta >= 0 ? '+' : ''}${rollingAvgDelta.toFixed(1)}`
          : null}
        shareUrl={shareUrl}
        teams={teams}
        isBowlerOfTheWeek={isBowlerOfTheWeek}
        currentTeam={latestSeason ? { name: latestSeason.teamName ?? 'Unknown', slug: latestSeason.teamSlug } : null}
        slug={slug}
      />

      <div className="mt-8 space-y-8">
        {lastWeek && weekDelta && (
          <LastWeekHighlight week={lastWeek} delta={weekDelta} />
        )}

        <TrackVisibility section="personal-records" page="bowler-profile">
          <PersonalRecordsPanel careerSummary={careerSummary} delta={weekDelta} slug={slug} />
        </TrackVisibility>

        {careerSummary && (
          <TrackVisibility section="milestone-watch" page="bowler-profile">
            <MilestoneWatch milestones={computePersonalMilestones(careerSummary)} />
          </TrackVisibility>
        )}

        <TrackVisibility section="you-are-a-star" page="bowler-profile">
          <YouAreAStar
            stats={starStats}
            slug={slug}
            inTicker={[...tickerItems, ...milestoneTickerItems(leagueMilestones)].some(t => t.href === `/bowler/${slug}`)}
            // EASTER EGG: Mike DePasquale 300 photo, Harper Gordek photo
            easterEgg={slug === 'mike-depasquale' ? { src: '/village-lanes-mp300.jpg', alt: 'Mike\'s 300 - Perfect Game at Village Lanes', width: 4032, height: 3024 } : slug === 'harper-gordek' ? { src: '/IMG_7806.jpeg', alt: 'Harper Gordek', width: 2016, height: 1512 } : undefined}
          />
        </TrackVisibility>

        {gameProfile && (
          <TrackVisibility section="game-profile" page="bowler-profile">
            <GameProfile profile={gameProfile} leagueAvgs={leagueGameAvgs} />
          </TrackVisibility>
        )}

        {rollingAvgHistory.length >= 6 && (
          <TrackVisibility section="average-progression" page="bowler-profile">
            <AverageProgressionChart history={rollingAvgHistory} bowlerName={bowler.bowlerName} />
          </TrackVisibility>
        )}

        <SeasonStatsTable seasons={seasonStats} />

        <GameLog gameLog={gameLog} highGame={careerSummary?.highGame} highSeries={careerSummary?.highSeries} patches={patches} />
      </div>

      <TrailNav current="/bowlers" seasonSlug={currentSlug} />
    </main>
  );
}
