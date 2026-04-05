/* VARIANT 1: Logo integrated into the results bar (parallax hero) */
import Link from 'next/link';
import Image from 'next/image';
import { ParallaxBg } from '@/components/ui/ParallaxBg';
import { formatMatchDate } from '@/lib/bowling-time';
import {
  getWeeklyHighlights,
  getCurrentSeasonSnapshot,
  getNextBowlingNights,
  getSeasonBySlug,
  getSeasonStandings,
  getSeasonSchedule,
  getSeasonMatchResults,
  getLeagueMilestones,
  milestoneTickerItems,
  getNewBlogBadgeId,
} from '@/lib/queries';
import { getPostBySlug, getAllPosts } from '@/lib/blog';
import { MilestoneTicker } from '@/components/home/MilestoneTicker';
import { SeasonSnapshot } from '@/components/home/SeasonSnapshot';
import { MiniStandings } from '@/components/home/MiniStandings';
import { ThisWeekMatchups } from '@/components/home/ThisWeekMatchups';
import { InlineCountdown } from '@/components/home/InlineCountdown';
import { PromotedBlogCard } from '@/components/home/PromotedBlogCard';
import { TrackVisibility } from '@/components/tracking/TrackVisibility';
import { InstagramStrip } from '@/components/home/InstagramStrip';
import { RecapSnapshotCard } from '@/components/home/RecapSnapshotCard';
import { getInstagramFeed } from '@/lib/queries/instagram';


export const metadata = {
  title: 'V1: Logo in Results Bar',
};

export default async function HomeV1() {
  const [seasonSnapshot, weeklyHighlights, bowlingNights, leagueMilestones, blogBadgeId, instagramPosts, allPosts] = await Promise.all([
    getCurrentSeasonSnapshot(),
    getWeeklyHighlights(),
    getNextBowlingNights(),
    getLeagueMilestones(),
    getNewBlogBadgeId(),
    getInstagramFeed(6),
    getAllPosts(),
  ]);

  const latestPost = allPosts[0] ?? null;
  const promotedSlug = blogBadgeId?.split('|')[0] ?? null;
  const promotedPost = promotedSlug ? await getPostBySlug(promotedSlug) : undefined;
  const [nextBowlingNight, followingBowlingNight] = bowlingNights;

  const allTickerItems = [...weeklyHighlights, ...milestoneTickerItems(leagueMilestones)]
    .sort((a, b) => a.text.localeCompare(b.text));

  let standings: Awaited<ReturnType<typeof getSeasonStandings>> = [];
  let weekSchedule: Awaited<ReturnType<typeof getSeasonSchedule>> = [];
  let nextWeekNumber = 0;
  let latestWeekDate: string | null = null;

  if (seasonSnapshot) {
    const season = await getSeasonBySlug(seasonSnapshot.slug);
    if (season) {
      const [allStandings, allSchedule, allMatchResults] = await Promise.all([
        getSeasonStandings(season.seasonID),
        getSeasonSchedule(season.seasonID),
        getSeasonMatchResults(season.seasonID),
      ]);
      standings = allStandings;
      const playedWeeks = new Set(allMatchResults.map(r => r.week));
      const scheduledWeeks = [...new Set(allSchedule.map(s => s.week))].sort((a, b) => a - b);
      nextWeekNumber = scheduledWeeks.find(w => !playedWeeks.has(w)) ?? 0;
      if (nextWeekNumber > 0) {
        weekSchedule = allSchedule.filter(s => s.week === nextWeekNumber);
      }
      const latestWeekSchedule = allSchedule.find(s => s.week === seasonSnapshot.weekNumber);
      if (latestWeekSchedule?.matchDate) {
        latestWeekDate = formatMatchDate(latestWeekSchedule.matchDate, { month: 'long', day: 'numeric', year: 'numeric' });
      }
    }
  }

  return (
    <div className="min-h-screen bg-cream">
      <TrackVisibility section="ticker" page="home">
        <MilestoneTicker items={allTickerItems} variant="dark" />
      </TrackVisibility>

      {/* V1: NO standalone logo section. Logo is inside the results bar. */}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-6 space-y-5 sm:space-y-6 mt-3 sm:mt-4">

        {/* === FULL WIDTH: Results bar WITH logo integrated === */}
        {seasonSnapshot && (
          <div className="relative rounded-xl overflow-hidden shadow-md ring-1 ring-navy/10">
            <ParallaxBg src="/village-lanes-chairs.jpg" imgW={2048} imgH={1536} focalY={0.5} mobileSrc="/village-lanes-lanes.jpg" mobileFocalY={0.6} mobileImgW={3024} mobileImgH={4032} />
            <div className="absolute inset-0 bg-black/55" />

            {/* Mobile: logo above, results + countdown below */}
            <div className="relative md:hidden">
              <div className="flex justify-center pt-4 pb-2">
                <Image
                  src="/splitzkrieg logo.png"
                  alt="Splitzkrieg Bowling League"
                  width={280}
                  height={100}
                  className="h-20 w-auto brightness-0 invert opacity-90"
                  unoptimized
                />
              </div>
              <Link
                href={`/week/${seasonSnapshot.slug}/${seasonSnapshot.weekNumber}`}
                className="flex flex-row group hover:bg-white/5 transition-colors border-t border-white/15"
              >
                <div className="flex-1 flex items-center px-4 py-3">
                  <div>
                    <div className="font-heading text-lg text-white group-hover:text-red-300 transition-colors">
                      Week {seasonSnapshot.weekNumber} Results
                    </div>
                    {latestWeekDate && <div className="font-body text-xs text-white/70 mt-0.5">{latestWeekDate}</div>}
                  </div>
                </div>
                <div className="w-px bg-white/15 my-3" />
                <div className="px-4 py-2 flex items-center justify-center overflow-hidden">
                  <InlineCountdown targetDate={nextBowlingNight} followingDate={followingBowlingNight} weekNumber={nextWeekNumber} />
                </div>
              </Link>
            </div>

            {/* Desktop: logo left, results center, countdown right */}
            <div className="relative hidden md:flex flex-row items-center">
              <div className="px-6 py-4 flex-shrink-0">
                <Image
                  src="/splitzkrieg logo.png"
                  alt="Splitzkrieg Bowling League"
                  width={200}
                  height={72}
                  className="h-14 w-auto brightness-0 invert opacity-90"
                  unoptimized
                />
              </div>
              <div className="w-px bg-white/15 my-3 self-stretch" />
              <Link
                href={`/week/${seasonSnapshot.slug}/${seasonSnapshot.weekNumber}`}
                className="flex-1 flex items-center justify-between px-6 py-4 group hover:bg-white/5 transition-colors"
              >
                <div>
                  <div className="font-heading text-2xl text-white group-hover:text-red-300 transition-colors">
                    Week {seasonSnapshot.weekNumber} Results
                  </div>
                  {latestWeekDate && <div className="font-body text-sm text-white/70 mt-0.5">{latestWeekDate}</div>}
                </div>
                <svg className="w-5 h-5 text-white/40 group-hover:text-white group-hover:translate-x-0.5 transition-all flex-shrink-0 ml-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </Link>
              <div className="w-px bg-white/15 my-3 self-stretch" />
              <div className="px-6 py-4 flex items-center justify-center overflow-hidden">
                <InlineCountdown targetDate={nextBowlingNight} followingDate={followingBowlingNight} weekNumber={nextWeekNumber} />
              </div>
            </div>
          </div>
        )}

        {/* Rest of page identical to current */}
        <div className="md:grid md:grid-cols-5 md:gap-6 space-y-5 md:space-y-0">
          {seasonSnapshot && (
            <TrackVisibility section="standings" page="home" className="md:col-span-3">
              <MiniStandings standings={standings} seasonSlug={seasonSnapshot.slug} romanNumeral={seasonSnapshot.romanNumeral} />
            </TrackVisibility>
          )}
          {seasonSnapshot && weekSchedule.length > 0 && nextWeekNumber > 0 && (
            <TrackVisibility section="matchups" page="home" className="md:col-span-2">
              <ThisWeekMatchups matchups={weekSchedule} matchResults={[]} seasonSlug={seasonSnapshot.slug} weekNumber={nextWeekNumber} romanNumeral={seasonSnapshot.romanNumeral} />
            </TrackVisibility>
          )}
        </div>

        {latestPost?.type === 'recap' && seasonSnapshot ? (
          <>
            <div className="hidden md:block">
              <TrackVisibility section="recap-snapshot" page="home">
                <RecapSnapshotCard post={latestPost} snapshot={seasonSnapshot} />
              </TrackVisibility>
            </div>
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

        {instagramPosts.length > 0 && (
          <TrackVisibility section="instagram-feed" page="home">
            <InstagramStrip posts={instagramPosts} />
          </TrackVisibility>
        )}
      </div>
    </div>
  );
}
