import Link from 'next/link';
import Image from 'next/image';
import { ParallaxBg } from '@/components/ui/ParallaxBg';
import { formatMatchDate } from '@/lib/bowling-time';
import {
  getWeeklyHighlights,
  getCurrentSeasonSnapshot,
  getSeasonBySlug,
  getSeasonStandings,
  getSeasonSchedule,
  getSeasonMatchResults,
  getLeagueMilestones,
  milestoneTickerItems,
  getNewBlogBadgeId,
  getSeasonChampionsCard,
} from '@/lib/queries';
import type { SeasonChampionsCardData } from '@/lib/queries';
import { getPostBySlug, getAllPosts } from '@/lib/blog';
import { MilestoneTicker } from '@/components/home/MilestoneTicker';
import { SeasonSnapshot } from '@/components/home/SeasonSnapshot';
import { MiniStandings } from '@/components/home/MiniStandings';
import { ThisWeekMatchups } from '@/components/home/ThisWeekMatchups';
import { PlayoffsNextWeek } from '@/components/home/PlayoffsNextWeek';
import { SeasonChampionsCard } from '@/components/home/SeasonChampionsCard';
import { InlineCountdown } from '@/components/home/InlineCountdown';
import { PromotedBlogCard } from '@/components/home/PromotedBlogCard';
import { TrackVisibility } from '@/components/tracking/TrackVisibility';
import { InstagramStrip } from '@/components/home/InstagramStrip';
import { RecapSnapshotCard } from '@/components/home/RecapSnapshotCard';
import { getInstagramFeed } from '@/lib/queries/instagram';
import { getRandomFacts } from '@/lib/queries/facts';
import { getPlayoffTeamMatches, getPlayoffBracketParticipants } from '@/lib/queries/playoffs/page';
import { RandomFact } from '@/components/home/RandomFact';


export const metadata = {
  title: 'Splitzkrieg Bowling League',
  description: 'Stats, records, and history for the Splitzkrieg Bowling League. Since 2007.',
};

export default async function Home() {
  const [seasonSnapshot, weeklyHighlights, leagueMilestones, blogBadgeId, instagramPosts, allPosts, randomFacts] = await Promise.all([
    getCurrentSeasonSnapshot(),
    getWeeklyHighlights(),
    getLeagueMilestones(),
    getNewBlogBadgeId(),
    getInstagramFeed(6),
    getAllPosts(),
    getRandomFacts(),
  ]);

  // Latest blog post for desktop sidebar; promoted post if badge active
  const latestPost = allPosts[0] ?? null;
  const promotedSlug = blogBadgeId?.split('|')[0] ?? null;
  const promotedPost = promotedSlug ? await getPostBySlug(promotedSlug) : undefined;

  // Merge milestone achievements into the ticker, sorted alphabetically by name
  const allTickerItems = [...weeklyHighlights, ...milestoneTickerItems(leagueMilestones)]
    .sort((a, b) => a.text.localeCompare(b.text));

  // Fetch standings + schedule for current season
  let standings: Awaited<ReturnType<typeof getSeasonStandings>> = [];
  let weekSchedule: Awaited<ReturnType<typeof getSeasonSchedule>> = [];
  let countdownSchedule: { week: number; matchDate: string }[] = [];

  let nextWeekNumber = 0;
  let latestWeekDate: string | null = null;
  let playoffsNextWeek: { divisionName: string; topSeed: { teamName: string; teamSlug: string }; secondSeed: { teamName: string; teamSlug: string } }[] = [];
  let playoffsRoundOneDate: string | null = null;
  let playoffFinal: { team1Name: string; team1Slug: string; team2Name: string; team2Slug: string } | null = null;
  let playoffFinalDate: string | null = null;
  let playoffBrackets: Array<{ title: string; bowlers: Array<{ bowlerName: string; slug: string }> }> = [];
  let championship: { romanNumeral: string; teamName: string; teamSlug: string; slug: string } | null = null;
  let championsCard: SeasonChampionsCardData | null = null;

  if (seasonSnapshot) {
    const season = await getSeasonBySlug(seasonSnapshot.slug);
    if (season) {
      const [allStandings, allSchedule, allMatchResults] = await Promise.all([
        getSeasonStandings(season.seasonID),
        getSeasonSchedule(season.seasonID),
        getSeasonMatchResults(season.seasonID),
      ]);
      standings = allStandings;

      // Find the next upcoming week: first scheduled week with no match results
      const playedWeeks = new Set(allMatchResults.map(r => r.week));
      const scheduledWeeks = [...new Set(allSchedule.map(s => s.week))].sort((a, b) => a - b);
      nextWeekNumber = scheduledWeeks.find(w => !playedWeeks.has(w)) ?? 0;

      if (nextWeekNumber > 0) {
        weekSchedule = allSchedule.filter(s => s.week === nextWeekNumber);
      }

      // Deduped per-week schedule for the client-side countdown. Shipping every
      // week (not just future ones) keeps the data time-independent — the
      // client picks the active entry from new Date() at render time, so the
      // cache key doesn't need to invalidate as dates pass.
      const weekToDate = new Map<number, string>();
      for (const s of allSchedule) {
        if (s.matchDate && !weekToDate.has(s.week)) {
          weekToDate.set(s.week, new Date(s.matchDate).toISOString());
        }
      }
      countdownSchedule = [...weekToDate.entries()]
        .map(([week, matchDate]) => ({ week, matchDate }))
        .sort((a, b) => a.matchDate.localeCompare(b.matchDate));

      // Get date for the latest played week
      const latestWeekSchedule = allSchedule.find(s => s.week === seasonSnapshot.weekNumber);
      if (latestWeekSchedule?.matchDate) {
        latestWeekDate = formatMatchDate(latestWeekSchedule.matchDate, { month: 'long', day: 'numeric', year: 'numeric' });
      }

      // Regular season is over → assemble playoff round 1 matchups (#1 vs #2 per division).
      if (nextWeekNumber === 0 && allStandings.length > 0) {
        const seedsByDivision = new Map<string, typeof allStandings>();
        for (const row of allStandings) {
          const div = row.divisionName;
          if (!div) continue;
          if (!seedsByDivision.has(div)) seedsByDivision.set(div, []);
          seedsByDivision.get(div)!.push(row);
        }
        playoffsNextWeek = [...seedsByDivision.entries()]
          .filter(([, rows]) => rows.length >= 2)
          .map(([divisionName, rows]) => ({
            divisionName,
            topSeed: { teamName: rows[0].teamName, teamSlug: rows[0].teamSlug },
            secondSeed: { teamName: rows[1].teamName, teamSlug: rows[1].teamSlug },
          }));

        playoffsRoundOneDate = '2026-05-11T00:00:00.000Z';

        // If the Final matchup exists in playoffResults, expose it so the
        // homepage "Up Next" card switches to the championship view.
        const finalMatches = await getPlayoffTeamMatches(season.seasonID, 2);
        if (finalMatches.length > 0) {
          const f = finalMatches[0];
          playoffFinal = {
            team1Name: f.team1Name,
            team1Slug: f.team1Slug,
            team2Name: f.team2Name,
            team2Slug: f.team2Slug,
          };
          playoffFinalDate = '2026-05-18T00:00:00.000Z';

          if (f.winnerTeamID != null) {
            const champTeamName = f.winnerTeamID === f.team1ID ? f.team1Name : f.team2Name;
            const champTeamSlug = f.winnerTeamID === f.team1ID ? f.team1Slug : f.team2Slug;
            championship = {
              romanNumeral: season.romanNumeral,
              teamName: champTeamName,
              teamSlug: champTeamSlug,
              slug: seasonSnapshot.slug,
            };
            championsCard = await getSeasonChampionsCard(season.seasonID);
          }

          // Also surface the round-2 bracket fields so the homepage card lists
          // who's bowling in each individual championship.
          const [mens, womens, hcp] = await Promise.all([
            getPlayoffBracketParticipants(season.seasonID, 'MensScratch', 2),
            getPlayoffBracketParticipants(season.seasonID, 'WomensScratch', 2),
            getPlayoffBracketParticipants(season.seasonID, 'Handicap', 2),
          ]);
          const toBracket = (
            title: string,
            list: Array<{ bowlerID: number; bowlerName: string; slug: string }>,
          ) => list.length > 0 ? { title, bowlers: list.map(b => ({ bowlerName: b.bowlerName, slug: b.slug })) } : null;
          playoffBrackets = [
            toBracket("Men's Scratch", mens),
            toBracket("Women's Scratch", womens),
            toBracket('Handicap', hcp),
          ].filter((b): b is { title: string; bowlers: Array<{ bowlerName: string; slug: string }> } => b !== null);
        }
      }

      // Surface playoff nights in the homepage countdown after the regular
      // season ends so the flip clock activates on semis/finals weeks.
      if (playoffsRoundOneDate) countdownSchedule.push({ week: 10, matchDate: playoffsRoundOneDate });
      if (playoffFinalDate) countdownSchedule.push({ week: 11, matchDate: playoffFinalDate });
      countdownSchedule.sort((a, b) => a.matchDate.localeCompare(b.matchDate));
    }
  }

  const showPromotedPost = promotedPost && promotedPost.type !== 'recap';

  return (
    <div className="min-h-screen bg-cream">
      {/* Milestone Ticker */}
      <TrackVisibility section="ticker" page="home">
        <MilestoneTicker items={allTickerItems} variant="dark" />
      </TrackVisibility>

      {/* Hero Section */}
      <section className="relative">
        <div className="absolute inset-0 bg-gradient-to-b from-navy/5 to-transparent" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-3 sm:-mt-6 pb-1 sm:pb-2">
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
            <p className="hidden sm:block font-body text-sm text-navy/60 -mt-5 sm:-mt-8">
              Stats, records, and {new Date().getFullYear() - 2007} years of league history
            </p>
          </div>
          <div className="hidden sm:block w-12 mx-auto border-t border-navy/30 mt-2 mb-2" />
          <RandomFact facts={randomFacts} />
        </div>
      </section>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-6 space-y-5 sm:space-y-6">

        {/* === FULL WIDTH: Week Results Bar (hero moment) === */}
        {seasonSnapshot && (() => {
          // Pre-season: promote the new-season schedule in the hero bar instead
          // of stale prior-season week results.
          const heroHref = '/schedule.html';
          const heroTitle = 'Season XXXVI Schedule';
          const heroSub = 'Fall 2026';
          return (
          <div className="relative rounded-xl overflow-hidden shadow-md ring-1 ring-navy/10">
            <ParallaxBg src="/village-lanes-chairs.jpg" imgW={2048} imgH={1536} focalY={0.5} mobileSrc="/village-lanes-lanes.jpg" mobileFocalY={0.6} mobileImgW={3024} mobileImgH={4032} />
            <div className="absolute inset-0 bg-black/60" />
            {/* Mobile: entire bar is clickable, side by side */}
            <Link
              href={heroHref}
              className="relative flex flex-row md:hidden group hover:bg-white/5 transition-colors"
            >
              <div className="flex-1 flex items-center px-4 py-3">
                <div>
                  <div className="font-heading text-lg text-white group-hover:text-red-300 transition-colors">
                    {heroTitle}
                  </div>
                  {heroSub && <div className="font-body text-xs text-white/70 mt-0.5">{heroSub}</div>}
                </div>
              </div>
              <div className="w-px bg-white/15 my-3" />
              <div className="px-4 py-2 flex items-center justify-center overflow-hidden">
                <InlineCountdown schedule={countdownSchedule} championship={championship} />
              </div>
            </Link>
            {/* Desktop: side-by-side layout */}
            <div className="relative hidden md:flex flex-row">
              <Link
                href={heroHref}
                className="flex-1 flex items-center justify-between px-6 py-4 group hover:bg-white/5 transition-colors"
              >
                <div>
                  <div className="font-heading text-2xl text-white group-hover:text-red-300 transition-colors">
                    {heroTitle}
                  </div>
                  {heroSub && <div className="font-body text-sm text-white/70 mt-0.5">{heroSub}</div>}
                </div>
                <svg className="w-5 h-5 text-white/40 group-hover:text-white group-hover:translate-x-0.5 transition-all flex-shrink-0 ml-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </Link>
              <div className="w-px bg-white/15 my-3" />
              <div className="px-6 py-4 flex items-center justify-center overflow-hidden">
                <InlineCountdown schedule={countdownSchedule} championship={championship} />
              </div>
            </div>
          </div>
          );
        })()}

        {/* === TWO COLUMNS: Standings | Matchups === */}
        <div className="md:grid md:grid-cols-5 md:gap-6 space-y-5 md:space-y-0">
          {seasonSnapshot && (
            <TrackVisibility section="standings" page="home" className="md:col-span-3">
              <MiniStandings
                standings={standings}
                seasonSlug={seasonSnapshot.slug}
                romanNumeral={seasonSnapshot.romanNumeral}
              />
            </TrackVisibility>
          )}
          {seasonSnapshot && weekSchedule.length > 0 && nextWeekNumber > 0 && (
            <TrackVisibility section="matchups" page="home" className="md:col-span-2">
              <ThisWeekMatchups
                matchups={weekSchedule}
                matchResults={[]}
                seasonSlug={seasonSnapshot.slug}
                weekNumber={nextWeekNumber}
                romanNumeral={seasonSnapshot.romanNumeral}
              />
            </TrackVisibility>
          )}
          {seasonSnapshot && nextWeekNumber === 0 && championship && championsCard && (
            <TrackVisibility section="season-champions" page="home" className="md:col-span-2">
              <SeasonChampionsCard
                romanNumeral={championship.romanNumeral}
                seasonSlug={championship.slug}
                champions={championsCard}
              />
            </TrackVisibility>
          )}
          {seasonSnapshot && nextWeekNumber === 0 && !championship && playoffsNextWeek.length > 0 && (
            <TrackVisibility section="playoffs-next-week" page="home" className="md:col-span-2">
              <PlayoffsNextWeek matchups={playoffsNextWeek} matchDate={playoffsRoundOneDate} seasonSlug={seasonSnapshot.slug} final={playoffFinal} finalDate={playoffFinalDate} brackets={playoffBrackets} />
            </TrackVisibility>
          )}
        </div>

        {/* === Blog + Snapshot === */}
        {latestPost?.type === 'recap' && seasonSnapshot ? (
          <>
            {/* Desktop: combined recap + snapshot card */}
            <div className="hidden md:block">
              <TrackVisibility section="recap-snapshot" page="home">
                <RecapSnapshotCard post={latestPost} snapshot={seasonSnapshot} />
              </TrackVisibility>
            </div>
            {/* Mobile: standard season snapshot */}
            <div className="md:hidden">
              <TrackVisibility section="season-snapshot" page="home">
                <SeasonSnapshot snapshot={seasonSnapshot} />
              </TrackVisibility>
            </div>
          </>
        ) : (
          <div className="md:grid md:grid-cols-2 md:gap-6 space-y-5 md:space-y-0">
            {latestPost && (
              <div className="hidden md:block h-full">
                <TrackVisibility section="promoted-blog" page="home" className="h-full">
                  <PromotedBlogCard post={latestPost} />
                </TrackVisibility>
              </div>
            )}
            <TrackVisibility section="season-snapshot" page="home">
              <SeasonSnapshot snapshot={seasonSnapshot} />
            </TrackVisibility>
          </div>
        )}

        {/* === FULL WIDTH: Instagram strip (visual break) === */}
        {instagramPosts.length > 0 && (
          <TrackVisibility section="instagram-feed" page="home">
            <InstagramStrip posts={instagramPosts} />
          </TrackVisibility>
        )}

      </div>
    </div>
  );
}
