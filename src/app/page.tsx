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
import { getPostBySlug } from '@/lib/blog';
import { MilestoneTicker } from '@/components/home/MilestoneTicker';
import { SeasonSnapshot } from '@/components/home/SeasonSnapshot';
import { MiniStandings } from '@/components/home/MiniStandings';
import { ThisWeekMatchups } from '@/components/home/ThisWeekMatchups';
import { InlineCountdown } from '@/components/home/InlineCountdown';
import { PromotedBlogCard } from '@/components/home/PromotedBlogCard';
import { TrackVisibility } from '@/components/tracking/TrackVisibility';
import { InstagramFeed } from '@/components/home/InstagramFeed';
import { getInstagramFeed } from '@/lib/queries/instagram';

export const metadata = {
  title: 'Splitzkrieg Bowling League',
  description: 'Stats, records, and history for the Splitzkrieg Bowling League. Since 2007.',
};

export default async function Home() {
  const [seasonSnapshot, weeklyHighlights, bowlingNights, leagueMilestones, blogBadgeId, instagramPosts] = await Promise.all([
    getCurrentSeasonSnapshot(),
    getWeeklyHighlights(),
    getNextBowlingNights(),
    getLeagueMilestones(),
    getNewBlogBadgeId(),
    getInstagramFeed(6),
  ]);

  // Fetch promoted blog post if badge is active
  const promotedSlug = blogBadgeId?.split('|')[0] ?? null;
  const promotedPost = promotedSlug ? await getPostBySlug(promotedSlug) : undefined;
  const [nextBowlingNight, followingBowlingNight] = bowlingNights;

  // Merge milestone achievements into the ticker, sorted alphabetically by name
  const allTickerItems = [...weeklyHighlights, ...milestoneTickerItems(leagueMilestones)]
    .sort((a, b) => a.text.localeCompare(b.text));

  // Fetch standings + schedule for current season
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

      // Find the next unplayed week (first scheduled week with no match results)
      const playedWeeks = new Set(allMatchResults.map(r => r.week));
      const scheduledWeeks = [...new Set(allSchedule.map(s => s.week))].sort((a, b) => a - b);
      nextWeekNumber = scheduledWeeks.find(w => !playedWeeks.has(w)) ?? 0;

      if (nextWeekNumber > 0) {
        weekSchedule = allSchedule.filter(s => s.week === nextWeekNumber);
      }

      // Get date for the latest played week
      const latestWeekSchedule = allSchedule.find(s => s.week === seasonSnapshot.weekNumber);
      if (latestWeekSchedule?.matchDate) {
        latestWeekDate = formatMatchDate(latestWeekSchedule.matchDate, { month: 'long', day: 'numeric', year: 'numeric' });
      }
    }
  }

  return (
    <div className="min-h-screen bg-cream">
      {/* Milestone Ticker */}
      <TrackVisibility section="ticker" page="home">
        <MilestoneTicker items={allTickerItems} variant="dark" />
      </TrackVisibility>

      {/* Hero Section */}
      <section className="relative">
        <div className="absolute inset-0 bg-gradient-to-b from-navy/5 to-transparent" />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 -mt-2 sm:-mt-1 pb-3 sm:pb-4">
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
            <p className="font-body text-sm sm:text-base text-navy/80 -mt-4 sm:-mt-6">
              Stats, records, and {new Date().getFullYear() - 2007} years of league history
            </p>
          </div>

          {/* This Week's Results + Countdown */}
          {seasonSnapshot && (
            <div className="relative mt-6 sm:mt-8 rounded-xl overflow-hidden shadow-md ring-1 ring-navy/10">
              <ParallaxBg src="/village-lanes-chairs.jpg" imgW={2048} imgH={1536} focalY={0.5} mobileSrc="/village-lanes-lanes.jpg" mobileFocalY={0.6} mobileImgW={3024} mobileImgH={4032} />
              <div className="absolute inset-0 bg-black/60" />
              <div className="relative flex flex-col sm:flex-row">
                {/* Left: Week Results link */}
                <Link
                  href={`/week/${seasonSnapshot.slug}/${seasonSnapshot.weekNumber}`}
                  className="flex-1 flex items-center justify-between px-6 py-4 group hover:bg-white/5 transition-colors"
                >
                  <div>
                    <div className="font-heading text-xl sm:text-2xl text-white group-hover:text-red-300 transition-colors">
                      Week {seasonSnapshot.weekNumber} Results
                    </div>
                    {latestWeekDate && <div className="font-body text-sm text-white/70 mt-0.5">{latestWeekDate}</div>}
                  </div>
                  <svg className="w-5 h-5 text-white/40 group-hover:text-white group-hover:translate-x-0.5 transition-all flex-shrink-0 ml-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </Link>
                <div className="hidden sm:block w-px bg-white/15 my-3" />
                <div className="sm:hidden mx-6 h-px bg-white/15" />
                <div className="px-6 py-4 flex items-center justify-center overflow-hidden">
                  <InlineCountdown targetDate={nextBowlingNight} followingDate={followingBowlingNight} weekNumber={nextWeekNumber} />
                </div>
              </div>
            </div>
          )}

        </div>
      </section>

      {/* Gradient Divider */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="h-px bg-gradient-to-r from-transparent via-navy/15 to-transparent" />
      </div>

      {/* Content Grid */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 pb-4 sm:pb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Mini Standings */}
          <TrackVisibility section="standings" page="home">
            <div>
              {seasonSnapshot && (
                <MiniStandings
                  standings={standings}
                  seasonSlug={seasonSnapshot.slug}
                  romanNumeral={seasonSnapshot.romanNumeral}
                />
              )}
            </div>
          </TrackVisibility>

          {/* Right column: This Week's Matchups + Season Snapshot */}
          <div className="space-y-6">
            <TrackVisibility section="season-snapshot" page="home">
              <SeasonSnapshot snapshot={seasonSnapshot} />
            </TrackVisibility>
            {seasonSnapshot && weekSchedule.length > 0 && nextWeekNumber > 0 && (
              <TrackVisibility section="matchups" page="home">
                <ThisWeekMatchups
                  matchups={weekSchedule}
                  matchResults={[]}
                  seasonSlug={seasonSnapshot.slug}
                  weekNumber={nextWeekNumber}
                  romanNumeral={seasonSnapshot.romanNumeral}
                />
              </TrackVisibility>
            )}
          </div>
        </div>

        {/* Promoted Blog Post */}
        {promotedPost && (
          <TrackVisibility section="promoted-blog" page="home">
            <div className="mt-6">
              <PromotedBlogCard post={promotedPost} />
            </div>
          </TrackVisibility>
        )}

        {instagramPosts.length > 0 && (
          <TrackVisibility section="instagram-feed" page="home">
            <div className="mt-6">
              <InstagramFeed posts={instagramPosts} />
            </div>
          </TrackVisibility>
        )}
      </section>
    </div>
  );
}
