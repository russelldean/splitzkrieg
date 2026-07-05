/**
 * Static bowler profile page.
 *
 * Bowler pages render fully on demand (dynamicParams = true, nothing prebuilt).
 * They fire ~14 queries each and their current-season data is live, so
 * prebuilding them re-queries the DB cold every build. On-demand keeps the heavy
 * read throttled to one page per request. This page notFound()s unknown slugs.
 *
 * Phase 2: Complete bowler profile with all five sections:
 * Hero header, personal records, average progression chart, season stats table, game log.
 */
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import {
  getBowlerBySlug,
  getBowlerCareerSummary,
} from '@/lib/queries';
import { getBowlerPageView, computeWeekDelta } from '@/lib/views/bowler-page';
import { getLeagueContext } from '@/lib/views/league-context';
import { RecordProgression } from '@/components/bowler/RecordProgression';
import { BowlerHero } from '@/components/bowler/BowlerHero';
import { PersonalRecordsPanel } from '@/components/bowler/PersonalRecordsPanel';
import { SeasonStatsTable } from '@/components/bowler/SeasonStatsTable';
import { AverageProgressionChartLazy as AverageProgressionChart } from '@/components/bowler/AverageProgressionChartLazy';
import { GameLog } from '@/components/bowler/GameLog';
import { YouAreAStar } from '@/components/bowler/YouAreAStar';
import { GameProfile } from '@/components/bowler/GameProfile';
import { MilestoneWatch } from '@/components/bowler/MilestoneWatch';
import { TrackVisibility } from '@/components/tracking/TrackVisibility';
import { TrailNav } from '@/components/ui/TrailNav';
import { StickyContextBar } from '@/components/ui/StickyContextBar';
import { computePersonalMilestones } from '@/lib/milestone-config';

// Historical slugs render on demand; unknown slugs still 404 via the page body.
export const dynamicParams = true;

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  // Nothing prebuilt: bowler pages fire ~14 queries each and their current-season
  // data is live, so prebuilding re-queries the DB cold every build (60s
  // static-gen timeouts, DB overload). Render fully on demand. Phase 3
  // consolidates the per-page queries so the on-demand render is fast.
  return [];
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

  const [view, league] = await Promise.all([
    getBowlerPageView(bowler.bowlerID),
    getLeagueContext(),
  ]);

  const { careerSummary, seasonStats, gameLog, rollingAvgHistory, patches, starStats, facts: bowlerFacts, teams, gameProfile } = view;
  const { botwIDs, currentSeasonID, currentSlug, leagueGameAvgs } = league;

  const isBowlerOfTheWeek = botwIDs.includes(bowler.bowlerID);

  // Current avg = rolling 27-game average (used for handicap on bowling nights)
  const currentAvg = careerSummary?.rollingAvg?.toFixed(1) ?? null;
  const rollingAvgDelta = careerSummary?.rollingAvg != null && careerSummary?.prevRollingAvg != null
    ? careerSummary.rollingAvg - careerSummary.prevRollingAvg
    : null;

  const latestSeason = seasonStats.length > 0 ? seasonStats[0] : null;
  const isCurrentSeason = latestSeason != null && latestSeason.seasonID === currentSeasonID;
  const lastWeek = (() => {
    const log = gameLog.filter(w => latestSeason && w.seasonID === latestSeason.seasonID);
    return log.length > 0 ? log[log.length - 1] : null;
  })();

  const weekDelta = computeWeekDelta(view, currentSeasonID);

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
        lastWeek={lastWeek}
      />

      <div className="mt-8 space-y-8">

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
            // EASTER EGG: Mike DePasquale 300 photo, Harper Gordek photo
            easterEgg={slug === 'mike-depasquale' ? { src: '/village-lanes-mp300.jpg', alt: 'Mike\'s 300 - Perfect Game at Village Lanes', width: 4032, height: 3024 } : slug === 'harper-gordek' ? { src: '/IMG_7806.jpeg', alt: 'Harper Gordek', width: 2016, height: 1512 } : undefined}
          />
        </TrackVisibility>

        {(gameProfile || bowlerFacts.length > 0) && (
          <div className="flex flex-col lg:flex-row lg:items-stretch gap-0">
            {gameProfile && (
              <div className="lg:w-[45%] min-w-0">
                <TrackVisibility section="game-profile" page="bowler-profile">
                  <GameProfile profile={gameProfile} leagueAvgs={leagueGameAvgs} />
                </TrackVisibility>
              </div>
            )}
            {gameProfile && bowlerFacts.length > 0 && (
              <div className="hidden lg:block w-px bg-navy/10 mx-6 self-stretch" />
            )}
            {bowlerFacts.length > 0 && (
              <div id="record-progression" className="flex-1 min-w-0 scroll-mt-24">
                <RecordProgression facts={bowlerFacts} bowlerName={bowler.bowlerName} />
              </div>
            )}
          </div>
        )}

        {rollingAvgHistory.length >= 6 && (
          <TrackVisibility section="average-progression" page="bowler-profile">
            <AverageProgressionChart history={rollingAvgHistory} bowlerName={bowler.bowlerName} />
          </TrackVisibility>
        )}

        <SeasonStatsTable seasons={seasonStats} />

        <GameLog gameLog={gameLog} highGame={careerSummary?.highGame} highSeries={careerSummary?.highSeries} patches={patches} />
      </div>

    </main>
  );
}
